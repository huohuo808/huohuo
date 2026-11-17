import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const realPublic = fs.realpathSync(publicDir);
const MAX_BODY = 2 * 1024 * 1024;

loadEnvFile(path.join(__dirname, ".env"));

const PORT = process.env.PORT === undefined || process.env.PORT === "" ? 4317 : Number(process.env.PORT);
const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  for (const line of text.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function apiKey() {
  const key = (process.env.DIFY_API_KEY || "").trim();
  return key;
}

function apiBase() {
  const raw = (process.env.DIFY_API_URL || "https://api.dify.ai/v1").trim();
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { error: "DIFY_API_URL 不是合法地址。" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { error: "DIFY_API_URL 只支持 http 或 https。" };
  }
  return { base: raw.replace(/\/$/, "") };
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("请求太大了。"), { status: 413, code: "payload_too_large" }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function matchRoute(method, pathname) {
  if (method === "POST" && pathname === "/v1/chat-messages") {
    return { upstream: "/chat-messages", method: "POST" };
  }
  let match = pathname.match(/^\/v1\/chat-messages\/([^/]+)\/stop$/);
  if (method === "POST" && match && ID_RE.test(match[1])) {
    return { upstream: `/chat-messages/${match[1]}/stop`, method: "POST" };
  }
  if (method === "GET" && pathname === "/v1/conversations") {
    return { upstream: "/conversations", method: "GET" };
  }
  if (method === "GET" && pathname === "/v1/messages") {
    return { upstream: "/messages", method: "GET" };
  }
  if (method === "GET" && pathname === "/v1/parameters") {
    return { upstream: "/parameters", method: "GET" };
  }
  match = pathname.match(/^\/v1\/conversations\/([^/]+)\/name$/);
  if (method === "POST" && match && ID_RE.test(match[1])) {
    return { upstream: `/conversations/${match[1]}/name`, method: "POST" };
  }
  match = pathname.match(/^\/v1\/conversations\/([^/]+)$/);
  if (method === "PATCH" && match && ID_RE.test(match[1])) {
    return { upstream: `/conversations/${match[1]}/name`, method: "POST" };
  }
  if (method === "DELETE" && match && ID_RE.test(match[1])) {
    return { upstream: `/conversations/${match[1]}`, method: "DELETE" };
  }
  return null;
}

async function proxy(req, res, url) {
  const key = apiKey();
  if (!key) {
    sendJson(res, 503, {
      code: "missing_api_key",
      message: "服务器未配置 DIFY_API_KEY。请把 .env.example 复制为 .env，填入密钥后重新运行 npm start。",
      status: 503,
    });
    return;
  }
  const baseInfo = apiBase();
  if (baseInfo.error) {
    sendJson(res, 500, { code: "bad_api_url", message: baseInfo.error, status: 500 });
    return;
  }
  const route = matchRoute(req.method, url.pathname);
  if (!route) {
    sendJson(res, 404, { code: "not_found", message: "没有这个接口。", status: 404 });
    return;
  }
  if (url.search.length > 4000) {
    sendJson(res, 400, { code: "invalid_param", message: "查询参数太长了。", status: 400 });
    return;
  }

  let body;
  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      body = await readBody(req);
    } catch (err) {
      if (res.writableEnded) return;
      sendJson(res, err.status || 400, {
        code: err.code || "bad_request",
        message: err.message || "请求无法读取。",
        status: err.status || 400,
      });
      return;
    }
  }

  const upstreamUrl = `${baseInfo.base}${route.upstream}${url.search}`;
  const controller = new AbortController();
  const onClose = () => {
    if (!res.writableEnded) controller.abort();
  };
  res.on("close", onClose);

  const headers = {
    Authorization: `Bearer ${key}`,
    Accept: req.headers.accept || "*/*",
  };
  if (body && body.length) {
    headers["Content-Type"] = req.headers["content-type"] || "application/json";
  }

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method: route.method,
      headers,
      body: body && body.length ? body : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    res.off("close", onClose);
    if (err.name === "AbortError" || res.writableEnded) return;
    sendJson(res, 502, {
      code: "upstream_unreachable",
      message: "连不上 Dify。请检查网络和 DIFY_API_URL。",
      status: 502,
    });
    return;
  }

  const contentType = upstream.headers.get("content-type") || "application/json; charset=utf-8";
  const responseHeaders = {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (contentType.includes("text/event-stream") || url.pathname === "/v1/chat-messages") {
    responseHeaders["Cache-Control"] = "no-cache, no-transform";
    responseHeaders["X-Accel-Buffering"] = "no";
    responseHeaders.Connection = "keep-alive";
  }
  res.writeHead(upstream.status, responseHeaders);
  res.socket?.setNoDelay(true);
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  if (!upstream.body) {
    res.end();
    res.off("close", onClose);
    return;
  }

  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (res.writableEnded || res.destroyed) {
        controller.abort();
        break;
      }
      res.write(Buffer.from(value));
    }
    if (!res.writableEnded) res.end();
  } catch (err) {
    if (err.name !== "AbortError" && !res.writableEnded) res.end();
  } finally {
    res.off("close", onClose);
  }
}

function resolveStatic(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const rel = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  if (!rel || rel.includes("\0")) return null;
  const full = path.normalize(path.join(publicDir, rel));
  const relative = path.relative(publicDir, full);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return full;
}

function serveStatic(res, pathname) {
  if (pathname === "/favicon.ico") {
    pathname = "/favicon.svg";
  }
  const full = resolveStatic(pathname);
  if (!full) {
    sendJson(res, 404, { code: "not_found", message: "找不到页面。", status: 404 });
    return;
  }
  let real;
  try {
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      sendJson(res, 404, { code: "not_found", message: "找不到页面。", status: 404 });
      return;
    }
    real = fs.realpathSync(full);
  } catch {
    sendJson(res, 404, { code: "not_found", message: "找不到页面。", status: 404 });
    return;
  }
  const rel = path.relative(realPublic, real);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    sendJson(res, 404, { code: "not_found", message: "找不到页面。", status: 404 });
    return;
  }
  const type = MIME[path.extname(real).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": type,
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy":
      "default-src 'self'; img-src 'self' data: https:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  });
  fs.createReadStream(real).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, configured: Boolean(apiKey()) });
    return;
  }
  if (url.pathname.startsWith("/v1/")) {
    proxy(req, res, url).catch((err) => {
      console.error("[huohuo] proxy error", err && err.name ? err.name : "error");
      if (!res.headersSent) {
        sendJson(res, 500, { code: "internal_error", message: "代理出错了。", status: 500 });
      } else if (!res.writableEnded) {
        res.end();
      }
    });
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { code: "method_not_allowed", message: "不支持这个操作。", status: 405 });
    return;
  }
  serveStatic(res, url.pathname);
});

server.requestTimeout = 0;
server.headersTimeout = 0;
server.timeout = 0;

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`[huohuo] 端口 ${PORT} 已被占用。可以在 .env 里修改 PORT。`);
    process.exit(1);
  }
  console.error("[huohuo] 服务启动失败");
  process.exit(1);
});

server.listen(PORT, "0.0.0.0", () => {
  const configured = apiKey() ? "已配置" : "未配置";
  const base = apiBase();
  const actual = server.address() && typeof server.address() === "object" ? server.address().port : PORT;
  console.log(`[huohuo] 页面已启动：http://127.0.0.1:${actual}`);
  console.log(`[huohuo] Dify：${base.base || base.error}`);
  console.log(`[huohuo] 密钥：${configured}`);
});
