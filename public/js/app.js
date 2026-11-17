import { ROLES, DEFAULT_ROLE_ID, getRole, roleByName, isSetupQuery, setupQuery, inputsFor } from "./roles.js";
import { createAccumulator, applyEvent, thoughtsForView, consumeSSEBuffer, flushSSEBuffer, isInputSchemaError } from "./stream.js";
import { renderMarkdown, renderUserText, escapeHtml } from "./markdown.js";

const USER_KEY = "huohuo.userId";
const ROLE_KEY = "huohuo.role";
const CONV_ROLE_KEY = "huohuo.convRoles";
const SIDEBAR_KEY = "huohuo.sidebarCollapsed";

const app = document.querySelector("#app");
const stage = document.querySelector("#stage");
const scroller = document.querySelector("#scroller");
const emptyEl = document.querySelector("#empty");
const messagesEl = document.querySelector("#messages");
const convList = document.querySelector("#conv-list");
const roleButton = document.querySelector("#role-button");
const roleLabel = document.querySelector("#role-label");
const roleMenu = document.querySelector("#role-menu");
const banner = document.querySelector("#banner");
const form = document.querySelector("#composer");
const textarea = document.querySelector("#input");
const sendBtn = document.querySelector("#send");
const stopBtn = document.querySelector("#stop");
const dialog = document.querySelector("#dialog");
const dialogTitle = document.querySelector("#dialog-title");
const dialogText = document.querySelector("#dialog-text");
const dialogCancel = document.querySelector("#dialog-cancel");
const dialogConfirm = document.querySelector("#dialog-confirm");
const toastEl = document.querySelector("#toast");
const live = document.querySelector("#live");
const backdrop = document.querySelector("#backdrop");

const state = {
  userId: "",
  roleId: DEFAULT_ROLE_ID,
  conversationId: null,
  conversationRoleId: DEFAULT_ROLE_ID,
  messages: [],
  conversations: [],
  convHasMore: false,
  convCursor: null,
  msgHasMore: false,
  msgCursor: null,
  streaming: false,
  taskId: null,
  abort: null,
  inputRejected: false,
  roleVariableMissing: false,
  configured: true,
  sendGen: 0,
  orphanId: null,
  loadingList: false,
  loadingOlder: false,
};

let toastTimer = 0;
let dialogAction = null;
let menuCloser = null;

function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

function loadUserId() {
  let id = localStorage.getItem(USER_KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(USER_KEY, id);
  }
  return id;
}

function loadConvRoles() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONV_ROLE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

const convRoles = loadConvRoles();

function persistConvRoles() {
  const keys = Object.keys(convRoles);
  if (keys.length > 300) {
    const keep = new Set(state.conversations.map((item) => item.id));
    if (state.conversationId) keep.add(state.conversationId);
    for (const key of keys) {
      if (!keep.has(key)) delete convRoles[key];
    }
  }
  localStorage.setItem(CONV_ROLE_KEY, JSON.stringify(convRoles));
}

function rememberConvRole(id, roleId) {
  if (!id || !getRole(roleId)) return;
  convRoles[id] = roleId;
  persistConvRoles();
}

function isMobile() {
  return window.matchMedia("(max-width: 860px)").matches;
}

function activeRole() {
  return getRole(state.conversationId ? state.conversationRoleId : state.roleId) || getRole(DEFAULT_ROLE_ID);
}

function displayTitle(name) {
  if (!name || name === "New conversation" || String(name).includes("[[huohuo:role-setup]]")) return "新对话";
  return name;
}

function chineseError(err) {
  if (!err || err.name === "AbortError") return "";
  const code = err.code || "";
  const status = Number(err.status || 0);
  if (code === "missing_api_key" || /DIFY_API_KEY/.test(err.message || "")) {
    return "服务器还没有配置 DIFY_API_KEY。请把 .env.example 复制为 .env，填入密钥后重新运行 npm start。";
  }
  if (status === 401 || code === "unauthorized") {
    return "Dify 拒绝了密钥。请检查 .env 里的 DIFY_API_KEY 是否正确，然后重启服务。";
  }
  if (code === "app_unavailable" || code === "app_not_found" || code === "app_api_disabled") {
    return "当前 Dify 应用不可用，可能已被关闭或删掉了 API 访问。";
  }
  if (code === "provider_not_initialize" || code === "provider_quota_exceeded") {
    return "模型还没配好，或额度已经用完。请到 Dify 里检查模型供应商。";
  }
  if (code === "rate_limit_error") return "请求太频繁了，稍等一会儿再试。";
  if (code === "upstream_unreachable") return err.message;
  if (code === "network" || status === 0) return "网络异常，没有连上本地服务。";
  if (status === 404) return "找不到这段对话，可能已经被删掉了。";
  const raw = (err.message || "").trim();
  if (raw && /[\u4e00-\u9fff]/.test(raw)) return raw;
  if (raw) return `请求失败：${raw}`;
  return "请求失败，请稍后再试。";
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 2800);
}

function setLive(text) {
  live.textContent = text;
}

function syncViewport() {
  const height = window.visualViewport?.height || window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${height}px`);
}

function autosize() {
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
}

function syncComposer() {
  const empty = !textarea.value.trim();
  sendBtn.hidden = state.streaming;
  stopBtn.hidden = !state.streaming;
  sendBtn.disabled = empty || state.streaming;
}

function nearBottom() {
  return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120;
}

function scrollToBottom() {
  scroller.scrollTop = scroller.scrollHeight;
}

async function apiJson(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (err) {
    if (err.name === "AbortError") throw err;
    const wrapped = new Error("网络异常，没有连上本地服务。");
    wrapped.code = "network";
    wrapped.status = 0;
    throw wrapped;
  }
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text.slice(0, 300) };
    }
  }
  if (!response.ok) {
    const error = new Error(data.message || "请求失败");
    error.status = data.status || response.status;
    error.code = data.code || "";
    throw error;
  }
  return data;
}

function openSidebar() {
  app.classList.add("sidebar-open");
  backdrop.hidden = false;
}

function closeSidebar() {
  app.classList.remove("sidebar-open");
  backdrop.hidden = true;
}

function toggleSidebar() {
  if (isMobile()) {
    if (app.classList.contains("sidebar-open")) closeSidebar();
    else openSidebar();
    return;
  }
  const collapsed = app.classList.toggle("sidebar-collapsed");
  localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
}

function renderRoleMenu() {
  roleLabel.textContent = activeRole().name;
  roleMenu.replaceChildren();
  for (const role of ROLES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "role-option";
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", role.id === activeRole().id ? "true" : "false");
    button.dataset.role = role.id;
    const text = document.createElement("span");
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = role.name;
    const blurb = document.createElement("span");
    blurb.className = "blurb";
    blurb.textContent = role.blurb;
    text.append(name, blurb);
    text.style.display = "flex";
    text.style.flexDirection = "column";
    text.style.minWidth = "0";
    button.append(text);
    if (role.id === activeRole().id) {
      const check = document.createElement("span");
      check.className = "check";
      check.textContent = "✓";
      button.append(check);
    }
    roleMenu.append(button);
  }
  if (state.roleVariableMissing) {
    const hint = document.createElement("p");
    hint.className = "role-hint";
    hint.textContent = "Dify 应用里还没有 role 变量。现在会在新对话开头写入角色说明；加上变量后会更稳。";
    roleMenu.append(hint);
  }
}

function renderEmpty() {
  const role = activeRole();
  emptyEl.replaceChildren();
  const title = document.createElement("h1");
  title.textContent = "火火";
  const who = document.createElement("p");
  who.className = "empty-role";
  who.textContent = `当前是「${role.name}」`;
  const line = document.createElement("p");
  line.className = "empty-line";
  line.textContent = role.line;
  const suggestions = document.createElement("div");
  suggestions.className = "suggestions";
  for (const text of role.suggestions) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.addEventListener("click", () => {
      textarea.value = text;
      autosize();
      syncComposer();
      void sendCurrent();
    });
    suggestions.append(button);
  }
  emptyEl.append(title, who, line, suggestions);
  emptyEl.hidden = state.messages.length > 0;
  stage.classList.toggle("is-empty", state.messages.length === 0);
  document.title = state.messages.length ? `${displayTitle(currentTitle())} · 火火` : "火火";
}

function currentTitle() {
  const found = state.conversations.find((item) => item.id === state.conversationId);
  return found ? displayTitle(found.name) : "新对话";
}

function thoughtHtml(thoughts) {
  const visible = (thoughts || []).filter((item) => (item.thought && item.thought.trim()) || (item.tool && item.tool.trim()));
  if (!visible.length) return "";
  const items = visible
    .map((item) => {
      const tool = item.tool && item.tool.trim() ? `<div class="thought-tool">调用了 ${escapeHtml(item.tool)}</div>` : "";
      const body = escapeHtml((item.thought || "").trim()).slice(0, 800);
      return `<div class="thought-item">${tool}${body}</div>`;
    })
    .join("");
  return `<details class="thoughts"><summary>思考过程</summary>${items}</details>`;
}

function answerInner(message) {
  if (message.error) {
    const retry = message.retry ? `<div><button type="button" data-retry="${escapeHtml(message.localId)}">重试</button></div>` : "";
    return `<div class="error-inline">${escapeHtml(message.error)}${retry}</div>`;
  }
  if (message.streaming && !message.content) {
    return `<div class="dots" aria-hidden="true"><span></span><span></span><span></span></div>`;
  }
  const cursor = message.streaming ? `<span class="cursor"></span>` : "";
  return `${renderMarkdown(message.content)}${cursor}`;
}

function renderMessages() {
  const stick = nearBottom();
  messagesEl.replaceChildren();
  for (const message of state.messages) {
    const item = document.createElement("li");
    item.className = `msg ${message.role}`;
    item.dataset.mid = message.localId;
    if (message.role === "assistant") {
      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.textContent = "火";
      avatar.setAttribute("aria-hidden", "true");
      const body = document.createElement("div");
      body.className = "msg-body";
      const thoughts = document.createElement("div");
      thoughts.className = "thought-slot";
      thoughts.innerHTML = thoughtHtml(message.thoughts);
      const answer = document.createElement("div");
      answer.className = "answer";
      answer.innerHTML = answerInner(message);
      body.append(thoughts, answer);
      item.append(avatar, body);
    } else {
      const body = document.createElement("div");
      body.className = "msg-body";
      body.innerHTML = renderUserText(message.content);
      item.append(body);
    }
    messagesEl.append(item);
  }
  if (stick) scrollToBottom();
}

function patchStreaming(message) {
  const root = messagesEl.querySelector(`[data-mid="${CSS.escape(message.localId)}"]`);
  if (!root) {
    renderMessages();
    return;
  }
  const stick = nearBottom();
  const slot = root.querySelector(".thought-slot");
  const answer = root.querySelector(".answer");
  if (slot) {
    const open = slot.querySelector("details")?.open;
    slot.innerHTML = thoughtHtml(message.thoughts);
    if (open) {
      const details = slot.querySelector("details");
      if (details) details.open = true;
    }
  }
  if (answer) answer.innerHTML = answerInner(message);
  if (stick) scrollToBottom();
}

function groupConversations(list) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const buckets = [
    { label: "今天", items: [] },
    { label: "昨天", items: [] },
    { label: "近 7 天", items: [] },
    { label: "更早", items: [] },
  ];
  for (const conv of list) {
    let stamp = Number(conv.updated_at || conv.created_at || 0);
    if (stamp < 1e12) stamp *= 1000;
    if (stamp >= startToday) buckets[0].items.push(conv);
    else if (stamp >= startToday - 86400000) buckets[1].items.push(conv);
    else if (stamp >= startToday - 6 * 86400000) buckets[2].items.push(conv);
    else buckets[3].items.push(conv);
  }
  return buckets.filter((bucket) => bucket.items.length);
}

function closeConvMenu() {
  document.querySelector(".conv-menu")?.remove();
  document.querySelector(".conv.menu-open")?.classList.remove("menu-open");
  if (menuCloser) {
    document.removeEventListener("pointerdown", menuCloser, true);
    menuCloser = null;
  }
}

function renderSidebar() {
  closeConvMenu();
  convList.replaceChildren();
  if (state.loadingList && !state.conversations.length) {
    const note = document.createElement("p");
    note.className = "list-note";
    note.textContent = "正在加载…";
    convList.append(note);
    return;
  }
  if (!state.conversations.length) {
    const note = document.createElement("p");
    note.className = "list-note";
    note.textContent = state.configured ? "还没有对话" : "配置密钥后就能开始";
    convList.append(note);
    return;
  }
  for (const group of groupConversations(state.conversations)) {
    const label = document.createElement("div");
    label.className = "group-label";
    label.textContent = group.label;
    convList.append(label);
    for (const conv of group.items) {
      const row = document.createElement("div");
      row.className = "conv";
      if (conv.id === state.conversationId) row.classList.add("active");
      const open = document.createElement("button");
      open.type = "button";
      open.className = "conv-open";
      open.dataset.open = conv.id;
      open.textContent = displayTitle(conv.name);
      open.title = displayTitle(conv.name);
      const more = document.createElement("button");
      more.type = "button";
      more.className = "conv-more";
      more.dataset.more = conv.id;
      more.dataset.name = conv.name || "";
      more.setAttribute("aria-label", "更多操作");
      more.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1" fill="currentColor" stroke="none"/></svg>`;
      row.append(open, more);
      convList.append(row);
    }
  }
  if (state.convHasMore) {
    const more = document.createElement("button");
    more.type = "button";
    more.className = "load-more";
    more.dataset.loadConvs = "1";
    more.textContent = "加载更多";
    convList.append(more);
  }
}

function renderAll() {
  renderRoleMenu();
  renderEmpty();
  renderMessages();
  renderSidebar();
  syncComposer();
}

function showBanner(text) {
  banner.textContent = text;
  banner.hidden = !text;
}

function noteRoleFromInputs(conversationId, inputs) {
  const role = roleByName(inputs?.role || inputs?.character);
  if (role) rememberConvRole(conversationId, role.id);
}

async function loadConversations({ append = false } = {}) {
  if (!state.configured) {
    state.conversations = [];
    renderSidebar();
    return;
  }
  state.loadingList = !append;
  if (!append) renderSidebar();
  const params = new URLSearchParams({
    user: state.userId,
    limit: "40",
    sort_by: "-updated_at",
  });
  if (append && state.convCursor) params.set("last_id", state.convCursor);
  try {
    const data = await apiJson(`/v1/conversations?${params}`);
    const items = data.data || [];
    state.conversations = append ? state.conversations.concat(items) : items;
    state.convHasMore = Boolean(data.has_more);
    state.convCursor = items.length ? items[items.length - 1].id : state.convCursor;
    for (const conv of items) noteRoleFromInputs(conv.id, conv.inputs);
  } catch (err) {
    if (!append) state.conversations = [];
    showToast(chineseError(err));
  } finally {
    state.loadingList = false;
    renderSidebar();
  }
}

function historyMessages(page) {
  const chronological = page.slice().reverse();
  const mapped = [];
  for (const item of chronological) {
    if (isSetupQuery(item.query)) {
      noteRoleFromInputs(item.conversation_id, item.inputs);
      continue;
    }
    noteRoleFromInputs(item.conversation_id, item.inputs);
    mapped.push({
      localId: `${item.id}:u`,
      remoteId: item.id,
      role: "user",
      content: item.query || "",
    });
    const thoughts = (item.agent_thoughts || []).map((thought) => ({
      id: thought.id,
      position: thought.position || 0,
      thought: thought.thought || "",
      tool: thought.tool || "",
      tool_input: thought.tool_input || "",
      observation: thought.observation || "",
    }));
    const failed = item.status === "error";
    if ((item.answer && item.answer.trim()) || failed || thoughtsForView(new Map(thoughts.map((thought) => [thought.id, thought]))).length) {
      mapped.push({
        localId: `${item.id}:a`,
        remoteId: item.id,
        role: "assistant",
        content: item.answer || "",
        thoughts,
        error: failed ? item.error || "这条回复没有生成成功。" : null,
      });
    }
  }
  return mapped;
}

async function openConversation(id) {
  if (!id || id === state.conversationId && state.messages.length) {
    if (isMobile()) closeSidebar();
    return;
  }
  state.sendGen += 1;
  haltStream();
  state.conversationId = id;
  const known = getRole(convRoles[id]);
  if (known) {
    state.conversationRoleId = known.id;
    state.roleId = known.id;
    localStorage.setItem(ROLE_KEY, known.id);
  }
  state.messages = [];
  state.msgHasMore = false;
  state.msgCursor = null;
  state.orphanId = null;
  renderAll();
  if (isMobile()) closeSidebar();
  const token = state.sendGen;
  try {
    const params = new URLSearchParams({
      user: state.userId,
      conversation_id: id,
      limit: "40",
    });
    const data = await apiJson(`/v1/messages?${params}`);
    if (token !== state.sendGen || state.conversationId !== id) return;
    const page = data.data || [];
    state.msgHasMore = Boolean(data.has_more);
    state.msgCursor = page.length ? page[page.length - 1].id : null;
    state.messages = historyMessages(page);
    renderAll();
    scrollToBottom();
  } catch (err) {
    if (token !== state.sendGen) return;
    showToast(chineseError(err));
  }
}

async function loadOlder() {
  if (!state.conversationId || !state.msgHasMore || state.loadingOlder || !state.msgCursor) return;
  state.loadingOlder = true;
  const token = state.sendGen;
  const id = state.conversationId;
  const prevHeight = scroller.scrollHeight;
  try {
    const params = new URLSearchParams({
      user: state.userId,
      conversation_id: id,
      limit: "40",
      first_id: state.msgCursor,
    });
    const data = await apiJson(`/v1/messages?${params}`);
    if (token !== state.sendGen || state.conversationId !== id) return;
    const page = data.data || [];
    state.msgHasMore = Boolean(data.has_more);
    if (page.length) state.msgCursor = page[page.length - 1].id;
    const older = historyMessages(page);
    const seen = new Set(state.messages.map((item) => item.remoteId).filter(Boolean));
    state.messages = older.filter((item) => !item.remoteId || !seen.has(item.remoteId)).concat(state.messages);
    renderMessages();
    scroller.scrollTop = scroller.scrollHeight - prevHeight;
  } catch (err) {
    showToast(chineseError(err));
  } finally {
    state.loadingOlder = false;
  }
}

function haltStream() {
  const taskId = state.taskId;
  const controller = state.abort;
  state.abort = null;
  state.taskId = null;
  state.streaming = false;
  if (controller) controller.abort();
  if (taskId) {
    fetch(`/v1/chat-messages/${encodeURIComponent(taskId)}/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: state.userId }),
    }).catch(() => {});
  }
}

async function deleteQuiet(id) {
  try {
    await apiJson(`/v1/conversations/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: state.userId }),
    });
    state.conversations = state.conversations.filter((item) => item.id !== id);
    delete convRoles[id];
    persistConvRoles();
    renderSidebar();
  } catch {
    // The sidebar refresh will reconcile a delete that did not land.
  }
}

function discardOrphan() {
  if (!state.orphanId) return;
  const id = state.orphanId;
  state.orphanId = null;
  if (state.conversationId === id) state.conversationId = null;
  void deleteQuiet(id);
}

async function readStream(body, { hidden, onUpdate, signal }) {
  const response = await fetch("/v1/chat-messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("text/event-stream")) {
    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text.slice(0, 300) };
    }
    if (!response.ok || data.code || data.event === "error") {
      const error = new Error(data.message || "请求失败");
      error.status = data.status || response.status;
      error.code = data.code || "";
      if (error.code === "missing_api_key") {
        state.configured = false;
        showBanner(chineseError(error));
      }
      throw error;
    }
    const acc = createAccumulator();
    if (typeof data.answer === "string") acc.answer = data.answer;
    if (data.conversation_id) acc.conversationId = data.conversation_id;
    if (data.task_id) acc.taskId = data.task_id;
    return acc;
  }

  const acc = createAccumulator();
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  const handle = (event) => {
    applyEvent(acc, event);
    if (acc.taskId) state.taskId = acc.taskId;
    if (acc.error) {
      const error = new Error(acc.error.message);
      error.code = acc.error.code;
      error.status = acc.error.status;
      throw error;
    }
    if (event.event === "ping") return;
    if (!hidden && onUpdate) onUpdate(acc);
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = consumeSSEBuffer(buffer, handle);
    }
    buffer += decoder.decode();
    flushSSEBuffer(buffer, handle);
  } finally {
    reader.cancel().catch(() => {});
  }
  if (acc.error) {
    const error = new Error(acc.error.message);
    error.code = acc.error.code;
    error.status = acc.error.status;
    throw error;
  }
  return acc;
}

async function runStream(options, signal) {
  const inputs = state.inputRejected ? {} : options.inputs || {};
  const body = {
    inputs,
    query: options.query,
    response_mode: "streaming",
    conversation_id: options.conversation_id || "",
    user: state.userId,
    auto_generate_name: false,
  };
  const streamOptions = { ...options, signal };
  try {
    return await readStream(body, streamOptions);
  } catch (err) {
    if (signal?.aborted || err?.name === "AbortError") throw err;
    if (!state.inputRejected && Object.keys(inputs).length && isInputSchemaError(err) && !options.onUpdateConsumed) {
      state.inputRejected = true;
      return readStream({ ...body, inputs: {} }, streamOptions);
    }
    throw err;
  }
}

function titleFrom(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 24 ? `${clean.slice(0, 24)}…` : clean;
}

async function renameConversation(id, name) {
  return apiJson(`/v1/conversations/${encodeURIComponent(id)}/name`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, auto_generate: false, user: state.userId }),
  });
}

function upsertConversation(id, name, role) {
  const now = Math.floor(Date.now() / 1000);
  const existing = state.conversations.find((item) => item.id === id);
  if (existing) {
    existing.name = name;
    existing.updated_at = now;
    state.conversations = [existing, ...state.conversations.filter((item) => item.id !== id)];
  } else {
    state.conversations.unshift({
      id,
      name,
      updated_at: now,
      inputs: { role: role.name, character: role.name },
    });
  }
  renderSidebar();
}

async function sendText(content) {
  const text = content.trim();
  if (!text || state.streaming) return;
  if (!state.configured) {
    showBanner("服务器还没有配置 DIFY_API_KEY。请把 .env.example 复制为 .env，填入密钥后重新运行 npm start。");
    return;
  }
  const role = activeRole();
  const gen = ++state.sendGen;
  const userMessage = { localId: uuid(), role: "user", content: text };
  const assistant = {
    localId: uuid(),
    role: "assistant",
    content: "",
    thoughts: [],
    streaming: true,
    error: null,
    retry: text,
  };
  state.messages.push(userMessage, assistant);
  textarea.value = "";
  autosize();
  state.streaming = true;
  syncComposer();
  renderEmpty();
  renderMessages();
  scrollToBottom();
  setLive("正在回复");

  const controller = new AbortController();
  state.abort = controller;
  state.taskId = null;
  let visible = false;
  let createdId = state.conversationId;

  try {
    if (!createdId) {
      const setup = await runStream(
        {
          query: setupQuery(role),
          inputs: inputsFor(role),
          conversation_id: "",
          hidden: true,
          onUpdate: (acc) => {
            if (acc.taskId) state.taskId = acc.taskId;
          },
        },
        controller.signal,
      );
      if (gen !== state.sendGen) {
        if (setup.conversationId) void deleteQuiet(setup.conversationId);
        return;
      }
      createdId = setup.conversationId;
      if (!createdId) throw new Error("没有拿到会话编号，没法继续这段对话。");
      state.conversationId = createdId;
      state.conversationRoleId = role.id;
      state.orphanId = createdId;
      rememberConvRole(createdId, role.id);
      upsertConversation(createdId, titleFrom(text) || "新对话", role);
      void renameConversation(createdId, titleFrom(text) || "新对话").catch(() => {});
    }

    let consumed = false;
    const result = await runStream(
      {
        query: text,
        inputs: inputsFor(role),
        conversation_id: createdId,
        hidden: false,
        onUpdate: (acc) => {
          if (gen !== state.sendGen) return;
          if (acc.answer) {
            visible = true;
            consumed = true;
            state.orphanId = null;
          }
          assistant.content = acc.answer;
          assistant.thoughts = thoughtsForView(acc);
          patchStreaming(assistant);
        },
        get onUpdateConsumed() {
          return consumed;
        },
      },
      controller.signal,
    );
    if (gen !== state.sendGen) return;
    assistant.content = result.answer;
    assistant.thoughts = thoughtsForView(result);
    assistant.streaming = false;
    state.orphanId = null;
    if (result.conversationId && !state.conversationId) state.conversationId = result.conversationId;
    if (!assistant.content.trim()) assistant.content = "（没有收到回复）";
    setLive("回复完成");
  } catch (err) {
    if (gen !== state.sendGen) return;
    assistant.streaming = false;
    if (err.name === "AbortError") {
      if (!visible) {
        state.messages = state.messages.filter((item) => item.localId !== userMessage.localId && item.localId !== assistant.localId);
        textarea.value = text;
        autosize();
        const orphan = state.orphanId;
        state.orphanId = null;
        if (state.conversationId === orphan) state.conversationId = null;
        if (orphan) await deleteQuiet(orphan);
        if (!state.messages.length) state.conversationId = null;
      }
      setLive("已停止");
    } else {
      assistant.error = chineseError(err);
      state.orphanId = null;
      setLive("回复失败");
    }
  } finally {
    if (gen !== state.sendGen) return;
    state.streaming = false;
    state.abort = null;
    state.taskId = null;
    renderAll();
    if (state.configured) void loadConversations();
    if (!isMobile()) textarea.focus();
  }
}

function sendCurrent() {
  return sendText(textarea.value);
}

async function retryMessage(localId) {
  const index = state.messages.findIndex((item) => item.localId === localId);
  if (index < 0 || state.streaming) return;
  const failed = state.messages[index];
  const text = failed.retry || "";
  if (!text) return;
  if (index > 0 && state.messages[index - 1].role === "user") state.messages.splice(index - 1, 2);
  else state.messages.splice(index, 1);
  await sendText(text);
}

function selectRole(id) {
  const role = getRole(id);
  if (!role) return;
  const changed = role.id !== activeRole().id;
  state.roleId = role.id;
  localStorage.setItem(ROLE_KEY, role.id);
  closeRoleMenu();
  if (!changed) return;
  if (state.conversationId || state.messages.length) {
    void startNewChat();
    return;
  }
  state.conversationRoleId = role.id;
  renderRoleMenu();
  renderEmpty();
}

function closeRoleMenu() {
  roleMenu.hidden = true;
  roleButton.setAttribute("aria-expanded", "false");
}

function toggleRoleMenu() {
  const open = roleMenu.hidden;
  roleMenu.hidden = !open;
  roleButton.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) renderRoleMenu();
}

async function startNewChat() {
  state.sendGen += 1;
  haltStream();
  discardOrphan();
  state.conversationId = null;
  state.conversationRoleId = state.roleId;
  state.messages = [];
  state.msgHasMore = false;
  state.msgCursor = null;
  renderAll();
  if (isMobile()) closeSidebar();
  if (!isMobile()) textarea.focus();
}

function beginRename(id, anchor) {
  const conv = state.conversations.find((item) => item.id === id);
  if (!conv) return;
  closeConvMenu();
  const row = anchor.closest(".conv");
  const opener = row?.querySelector(".conv-open");
  if (!opener) return;
  const input = document.createElement("input");
  input.className = "rename-input";
  input.value = displayTitle(conv.name) === "新对话" ? "" : displayTitle(conv.name);
  input.setAttribute("aria-label", "重命名对话");
  opener.replaceWith(input);
  input.focus();
  input.select();
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    renderSidebar();
  };
  const commit = async () => {
    if (settled) return;
    settled = true;
    const name = input.value.trim();
    if (!name || name === displayTitle(conv.name)) {
      renderSidebar();
      return;
    }
    conv.name = name;
    renderSidebar();
    try {
      await renameConversation(id, name);
    } catch (err) {
      showToast(chineseError(err));
      void loadConversations();
    }
  };
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      finish();
    }
  });
  input.addEventListener("blur", () => {
    void commit();
  });
}

function openMenu(id, anchor) {
  closeConvMenu();
  const row = anchor.closest(".conv");
  row?.classList.add("menu-open");
  const menu = document.createElement("div");
  menu.className = "conv-menu";
  const rename = document.createElement("button");
  rename.type = "button";
  rename.textContent = "重命名";
  rename.addEventListener("click", () => beginRename(id, anchor));
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "danger-text";
  remove.textContent = "删除";
  remove.addEventListener("click", () => {
    closeConvMenu();
    const conv = state.conversations.find((item) => item.id === id);
    askDelete(id, displayTitle(conv?.name));
  });
  menu.append(rename, remove);
  document.body.append(menu);
  const rect = anchor.getBoundingClientRect();
  const width = 148;
  let left = Math.min(rect.right - width, window.innerWidth - width - 8);
  left = Math.max(8, left);
  let top = rect.bottom + 6;
  if (top + 96 > window.innerHeight) top = Math.max(8, rect.top - 96);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menuCloser = (event) => {
    if (menu.contains(event.target) || anchor.contains(event.target)) return;
    closeConvMenu();
  };
  setTimeout(() => document.addEventListener("pointerdown", menuCloser, true), 0);
}

function askDelete(id, name) {
  dialogTitle.textContent = "删除这段对话？";
  dialogText.textContent = name ? `「${name}」删除后无法恢复。` : "删除后无法恢复。";
  dialog.hidden = false;
  dialogCancel.focus();
  dialogAction = async () => {
    try {
      await apiJson(`/v1/conversations/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: state.userId }),
      });
      state.conversations = state.conversations.filter((item) => item.id !== id);
      delete convRoles[id];
      persistConvRoles();
      if (state.conversationId === id) {
        state.sendGen += 1;
        haltStream();
        state.conversationId = null;
        state.messages = [];
        state.conversationRoleId = state.roleId;
        renderAll();
      } else {
        renderSidebar();
      }
    } catch (err) {
      showToast(chineseError(err));
    }
  };
}

function closeDialog() {
  dialog.hidden = true;
  dialogAction = null;
}

async function checkParameters() {
  if (!state.configured) return;
  try {
    const data = await apiJson("/v1/parameters");
    const formFields = data.user_input_form || [];
    let found = false;
    for (const row of formFields) {
      if (!row || typeof row !== "object") continue;
      for (const spec of Object.values(row)) {
        if (spec && (spec.variable === "role" || spec.variable === "character")) found = true;
      }
    }
    state.roleVariableMissing = !found;
    renderRoleMenu();
  } catch {
    state.roleVariableMissing = false;
  }
}

function bind() {
  document.querySelector("#new-chat").addEventListener("click", () => void startNewChat());
  document.querySelector("#header-new").addEventListener("click", () => void startNewChat());
  document.querySelector("#open-sidebar").addEventListener("click", toggleSidebar);
  document.querySelector("#close-sidebar").addEventListener("click", closeSidebar);
  backdrop.addEventListener("click", closeSidebar);
  roleButton.addEventListener("click", toggleRoleMenu);
  roleMenu.addEventListener("click", (event) => {
    const option = event.target.closest("[data-role]");
    if (option) selectRole(option.dataset.role);
  });
  document.addEventListener("pointerdown", (event) => {
    if (roleMenu.hidden) return;
    if (roleMenu.contains(event.target) || roleButton.contains(event.target)) return;
    closeRoleMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeRoleMenu();
      closeConvMenu();
      if (!dialog.hidden) closeDialog();
      else if (isMobile()) closeSidebar();
    }
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "o") {
      event.preventDefault();
      void startNewChat();
    }
  });
  convList.addEventListener("click", (event) => {
    const more = event.target.closest("[data-more]");
    if (more) {
      event.stopPropagation();
      openMenu(more.dataset.more, more);
      return;
    }
    const open = event.target.closest("[data-open]");
    if (open) {
      void openConversation(open.dataset.open);
      return;
    }
    if (event.target.closest("[data-load-convs]")) void loadConversations({ append: true });
  });
  messagesEl.addEventListener("click", (event) => {
    const copy = event.target.closest("[data-copy-code]");
    if (copy) {
      const code = copy.closest(".codeblock")?.querySelector("code")?.textContent || "";
      navigator.clipboard?.writeText(code).then(
        () => {
          copy.textContent = "已复制";
          setTimeout(() => {
            copy.textContent = "复制";
          }, 1200);
        },
        () => showToast("复制失败了"),
      );
      return;
    }
    const retry = event.target.closest("[data-retry]");
    if (retry) void retryMessage(retry.dataset.retry);
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!state.streaming) void sendCurrent();
  });
  let composing = false;
  textarea.addEventListener("compositionstart", () => {
    composing = true;
  });
  textarea.addEventListener("compositionend", () => {
    composing = false;
  });
  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !composing && !event.isComposing) {
      event.preventDefault();
      if (!state.streaming) void sendCurrent();
    }
  });
  textarea.addEventListener("input", () => {
    autosize();
    syncComposer();
  });
  stopBtn.addEventListener("click", () => {
    const taskId = state.taskId;
    if (state.abort) state.abort.abort();
    if (taskId) {
      fetch(`/v1/chat-messages/${encodeURIComponent(taskId)}/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: state.userId }),
      }).catch(() => {});
    }
  });
  scroller.addEventListener("scroll", () => {
    if (scroller.scrollTop < 48) void loadOlder();
  });
  dialogCancel.addEventListener("click", closeDialog);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });
  dialogConfirm.addEventListener("click", async () => {
    const action = dialogAction;
    closeDialog();
    if (action) await action();
  });
  window.addEventListener("resize", syncViewport);
  window.visualViewport?.addEventListener("resize", syncViewport);
}

async function init() {
  state.userId = loadUserId();
  const savedRole = getRole(localStorage.getItem(ROLE_KEY) || "");
  state.roleId = savedRole?.id || DEFAULT_ROLE_ID;
  state.conversationRoleId = state.roleId;
  if (!isMobile() && localStorage.getItem(SIDEBAR_KEY) === "1") app.classList.add("sidebar-collapsed");
  bind();
  syncViewport();
  autosize();
  renderAll();
  try {
    const health = await apiJson("/api/health");
    state.configured = Boolean(health.configured);
    if (!state.configured) {
      showBanner("服务器还没有配置 DIFY_API_KEY。请把 .env.example 复制为 .env，填入密钥后重新运行 npm start。");
    }
  } catch (err) {
    state.configured = false;
    showBanner(chineseError(err));
  }
  renderSidebar();
  if (state.configured) {
    await loadConversations();
    void checkParameters();
  }
  if (!isMobile()) textarea.focus();
}

init();
