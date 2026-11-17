---
title: 火火
emoji: 🤖
colorFrom: yellow
colorTo: gray
sdk: docker
app_port: 4317
pinned: false
---

# 火火

火火是一个中文对话页面，接在你自己的 Dify 应用上。界面接近常见的对话网站：左侧是历史会话，右侧是当前对话，底部是输入框。

浏览器只跟本机服务说话。`DIFY_API_KEY` 留在服务端，页面里不会出现，也不会写进本地存储。

默认角色按这个顺序：

1. 盲命天涯峰哥
2. 猫娘
3. 秦澈
4. 蜡笔小新

没有上次选择时，默认是猫娘。选过之后会记住。

## 环境

需要 Node.js 18 或更高版本。

## 配置

```bash
cp .env.example .env
```

打开 `.env`，把 `DIFY_API_KEY` 换成你在 Dify 应用「访问 API」里创建的密钥。不要把填好的 `.env` 提交到仓库。

自建 Dify 时，再改 `DIFY_API_URL`，末尾保留 `/v1`。云端可以不改，默认是 `https://api.dify.ai/v1`。

## 启动

```bash
npm install
npm start
```

当前没有第三方依赖，`npm install` 会很快结束。看到类似下面的日志后，用浏览器打开：

```text
http://127.0.0.1:4317
```

端口可以用 `.env` 里的 `PORT` 改。

## 使用

- 左上角「新对话」另起一段聊天。
- 顶栏可以切换角色。换成另一个角色时，会清空当前画面并开始一段新对话，旧对话还在左侧。
- 回车发送，Shift+回车换行。生成过程中可以停止。
- 左侧会话可以打开、重命名和删除。手机上点左上角按钮展开侧栏。

## 角色是怎么带上的

这个 Dify 应用目前的 `user_input_form` 是空的，还没有正式的角色变量。页面仍然会在每一次 `chat-messages` 请求里带上：

```json
{ "role": "当前角色名", "character": "当前角色名" }
```

这样你在 Dify 里加上同名变量之后，不用改前端就会传进去。

在那之前，每次新对话的第一轮会先发一条角色说明。这条说明以 `[[huohuo:role-setup]]` 开头，只用来让模型进入角色。页面不把它画成用户气泡，打开历史时也会滤掉。随后你的原话会发到同一个 `conversation_id`，后面的来回都沿用这个会话。

如果 Dify 因为还没声明变量而拒绝 `inputs.role`，这一轮会自动改用不带该字段的请求再发一次，对话仍然能进行，角色靠开头那条说明维持。刷新页面后会重新尝试带上变量。

建议在 Dify 应用里添加一个文本变量，变量名用 `role`。提示词里可以写「你正在扮演 {{role}}」。`character` 是同一角色名的备用字段，可以不建。变量加上之后，角色会更稳。

## 目录

- `server.js`：本地服务。托管页面，并把 `/v1/*` 转到 Dify。密钥只在这里使用。
- `public/index.html`、`public/css/app.css`、`public/js/app.js`：页面。
- `public/js/roles.js`：四个角色和开场说明。
- `public/js/stream.js`：解析 Dify 的 SSE（`agent_message`、`agent_thought`、`message`、`message_end`、`error`）。
- `.env.example`：配置样例，不含密钥。

## 在 Hugging Face Spaces 上运行

在 Space 的 Secrets 里设置：

- `DIFY_API_KEY`：Dify 应用的 API 密钥
- `DIFY_API_URL`：默认可用 `https://api.dify.ai/v1`

不要把密钥写进仓库或 Dockerfile。
