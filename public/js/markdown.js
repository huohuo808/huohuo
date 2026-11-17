export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderUserText(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

export function renderMarkdown(source) {
  const text = String(source ?? "").replace(/\r\n/g, "\n");
  const blocks = [];
  const re = /```([^\n`]*)\n?([\s\S]*?)```/g;
  let last = 0;
  let match;
  while ((match = re.exec(text))) {
    if (match.index > last) blocks.push({ type: "md", text: text.slice(last, match.index) });
    blocks.push({ type: "code", lang: match[1].trim(), code: match[2].replace(/\n$/, "") });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    const rest = text.slice(last);
    const open = rest.match(/```([^\n`]*)\n?([\s\S]*)$/);
    if (open && open.index !== undefined) {
      const before = rest.slice(0, open.index);
      if (before) blocks.push({ type: "md", text: before });
      blocks.push({ type: "code", lang: open[1].trim(), code: open[2] });
    } else {
      blocks.push({ type: "md", text: rest });
    }
  }
  return blocks.map((block) => (block.type === "code" ? renderCode(block.lang, block.code) : renderBlocks(block.text))).join("");
}

function renderCode(lang, code) {
  const label = escapeHtml(lang || "代码");
  return `<div class="codeblock"><div class="codeblock-bar"><span>${label}</span><button type="button" class="copy" data-copy-code>复制</button></div><pre><code>${escapeHtml(code)}</code></pre></div>`;
}

function isBlockStart(line) {
  return /^(#{1,3}\s+|>\s?|\s*[-*]\s+|\s*\d+[.)]\s+)/.test(line);
}

function renderBlocks(text) {
  const lines = text.split("\n");
  let html = "";
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      html += `<h${level}>${inline(heading[2])}</h${level}>`;
      i += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const acc = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        acc.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }
      html += `<blockquote>${acc.map((item) => inline(item)).join("<br>")}</blockquote>`;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const acc = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        acc.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i += 1;
      }
      html += `<ul>${acc.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`;
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const acc = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        acc.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""));
        i += 1;
      }
      html += `<ol>${acc.map((item) => `<li>${inline(item)}</li>`).join("")}</ol>`;
      continue;
    }
    const acc = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
      acc.push(lines[i]);
      i += 1;
    }
    html += `<p>${acc.map((item) => inline(item)).join("<br>")}</p>`;
  }
  return html;
}

function inline(raw) {
  const codes = [];
  let html = escapeHtml(raw).replace(/`([^`]+)`/g, (_, code) => {
    codes.push(code);
    return `\u0000${codes.length - 1}\u0000`;
  });
  html = html.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  html = html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\u0000(\d+)\u0000/g, (_, index) => `<code>${codes[Number(index)]}</code>`);
  return html;
}
