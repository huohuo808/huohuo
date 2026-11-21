# 证目 · Expo App（MVP Demo）

这是 **Expo / React Native 原生 App 工程**，不是 HTML 网页壳。

线性流程：建案 → 证据组 → 待证事实 → 生成证明目的 → 引用核验(待核) → 对照修订 → 律师确认 → 导出。

## 用 Expo Go 打开（推荐）

1. 手机安装 [Expo Go](https://expo.dev/go)（iOS / Android）
2. 本机：

```bash
cd zhengmu-mvp
npm install
npx expo start
```

3. 终端会出现 **QR code**；用 Expo Go 扫码（同一局域网），或按 `a`/`i` 开模拟器。
4. 进入闪屏 →「打开 App」→「开始线性流程」。

Tunnel（跨网）：`npx expo start --tunnel`

## Web 预览（次要，仅便于截图/无手机时）

```bash
npx expo start --web
```

Web 用的是 React Native Web，仍是同一套 RN 源码，**不是**旧版 HTML phone-frame。

## 工程要点

- `App.js` + `src/data.js` + `src/theme.js`：证目流程 UI 与 Mock 数据
- `app.json`：Expo 应用名「证目」
- 不做一键可上庭文书；待核引用不可伪装已确认
