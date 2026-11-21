# 证目 · Expo App（MVP Demo）

**Expo / React Native 原生 App**，不是 HTML 网页壳。

完整中文本地打开说明（给 PM）：见 Project 文档  
`docs/mvp-demo-readme.md`  
演示案件包：`demo-case/`（与 `docs/demo-case/` 同步）。

## 最快打开（Expo Go）

```bash
cd zhengmu-mvp
npm install
npx expo start
```

手机装 Expo Go → 扫终端二维码（同一 Wi‑Fi）。  
扫不了：`npx expo start --tunnel`  
无手机：`npx expo start --web`

## 演示数据

App Mock 读取 `demo-case/evidence-list.json` + `mock-purposes.json`（交通事故人伤）。  
金标证明目的：`demo-case/proof-objectives-gold.md`。
