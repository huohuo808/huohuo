export function createAccumulator() {
  return {
    answer: "",
    seenAgentMessage: false,
    conversationId: "",
    taskId: "",
    messageId: "",
    thoughts: new Map(),
    error: null,
  };
}

export function applyEvent(acc, ev) {
  if (!ev || typeof ev !== "object") return acc;
  if (ev.task_id) acc.taskId = ev.task_id;
  if (ev.conversation_id) acc.conversationId = ev.conversation_id;
  if (ev.message_id) acc.messageId = ev.message_id;
  else if (ev.event === "message_end" && ev.id) acc.messageId = ev.id;

  switch (ev.event) {
    case "ping":
      break;
    case "error":
      acc.error = {
        code: ev.code || "",
        message: ev.message || "生成失败",
        status: ev.status || 400,
      };
      break;
    case "agent_thought": {
      const id = ev.id || `pos-${ev.position || acc.thoughts.size + 1}`;
      const prev = acc.thoughts.get(id) || {
        id,
        position: ev.position || 0,
        thought: "",
        tool: "",
        tool_input: "",
        observation: "",
      };
      if (ev.position) prev.position = ev.position;
      if (ev.thought) prev.thought = ev.thought;
      if (ev.tool) prev.tool = ev.tool;
      if (ev.tool_input) prev.tool_input = ev.tool_input;
      if (ev.observation) prev.observation = ev.observation;
      acc.thoughts.set(id, prev);
      break;
    }
    case "message_replace":
      acc.answer = ev.answer || "";
      break;
    case "agent_message":
      acc.seenAgentMessage = true;
      acc.answer += ev.answer || "";
      break;
    case "message": {
      const chunk = ev.answer || "";
      if (!chunk) break;
      if (acc.seenAgentMessage) acc.answer = chunk;
      else acc.answer += chunk;
      break;
    }
    default:
      break;
  }
  return acc;
}

export function thoughtsForView(acc) {
  const list = acc instanceof Map ? [...acc.values()] : [...acc.thoughts.values()];
  return list
    .filter((item) => (item.thought && item.thought.trim()) || (item.tool && item.tool.trim()))
    .sort((a, b) => (a.position || 0) - (b.position || 0));
}

export function consumeSSEBuffer(buffer, onEvent) {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const parts = normalized.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const part of parts) dispatchFrame(part, onEvent);
  return rest;
}

export function flushSSEBuffer(buffer, onEvent) {
  const rest = consumeSSEBuffer(buffer, onEvent);
  if (rest.trim()) dispatchFrame(rest, onEvent);
  return "";
}

function dispatchFrame(frame, onEvent) {
  const data = [];
  for (const line of frame.split("\n")) {
    if (!line.startsWith("data:")) continue;
    data.push(line.slice(5).replace(/^ /, ""));
  }
  if (!data.length) return;
  const payload = data.join("\n").trim();
  if (!payload || payload === "[DONE]") return;
  try {
    onEvent(JSON.parse(payload));
  } catch {
    // Ignore keep-alives and partial noise.
  }
}

export function isInputSchemaError(err) {
  const status = Number(err?.status || 0);
  if (status && status !== 400) return false;
  const blob = `${err?.code || ""} ${err?.message || ""}`.toLowerCase();
  const mentionsField = /role|character/.test(blob);
  const mentionsSchema = /invalid param|invalid_param|variable|input form|additional propert|not exist|not found|unexpected|not a valid|not defined|not allowed/.test(blob);
  if (mentionsField && mentionsSchema) return true;
  if (/additional propert/.test(blob) && /input|role|character/.test(blob)) return true;
  return false;
}
