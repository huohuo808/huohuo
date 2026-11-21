# 证目 MVP Demo

诉讼律师「证明目的」工作台演示：证据组 → 生成短句 → 引用已核验/待核 → 对照修订 → 律师确认导出。

完整运行说明见 Project 文档：`docs/mvp-demo-readme.md`。

```bash
cd zhengmu-mvp
python3 -m http.server 5173 --bind 0.0.0.0
# 打开 http://127.0.0.1:5173/
```

纯静态 HTML/CSS/JS，无后端依赖；样例为交通事故人伤证据目录。
