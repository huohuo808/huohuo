# 证目 APP Demo（MVPDemo）

手机 App 壳 + PWA：闪屏入口、底部 Tab（首页 / 流程 / 案件）、线性流程图旅程。

```bash
cd zhengmu-mvp
python3 -m http.server 5173 --bind 0.0.0.0
# 桌面：http://127.0.0.1:5173/ （外框为 iPhone 壳）
# 手机：同址全屏，可「添加到主屏幕」
```

流程：建案 → 证据组 → 待证事实 → 生成 → 核验(待核) → 对照修订 → 律师确认 → 导出。  
不做一键可上庭文书。
