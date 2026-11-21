# 第二周作业交付 · 证目

**产品：** 证目  
**一句话：** 帮诉讼律师把证据目录里的「证明目的」写得简洁、可核对、可溯源；律师终审，不做一键可上庭文书。

---

## 一、问题与用户

**目标用户**  
民商事诉讼主办律师（主）；助理/实习生出初稿（次）。MVP 不做当事人自助出文书、不做法院内网。

**典型场景（2）**  
1. 举证前编证据目录：证明目的要短句、绑日期/金额；受访者反馈通用 AI 写证明目的「像一坨」、引用常错（学姐访谈）。  
2. 客户甩来 AI 稿：律师要核验引用、改简洁、对照修订后终审。

**核心痛点（访谈）**  
证明目的质量差 → 幻觉/创制法条 → 文书需大改 → 专业库获取成本高、账号摩擦。  
底线：AI 不能替人担责；不做「一键可上庭」。

---

## 二、市场与机会

**竞品 / 替代（≥2，带来源）**  

| 类型 | 代表 | 事实 / 受访者反馈 |
|------|------|-------------------|
| 通用 AI | 豆包 / DeepSeek | `[访谈]` 可出草稿，但有「创制法条 / 硬匹配案例」、证明目的不简洁 |
| 办公 AI | workbuddy | `[访谈]` 可用于文书草稿；合同场景习惯「只出对照修改稿，律师自己改」 |
| 专业库 | 法宝 / 威科 | `[访谈]` 律师圈常用专业检索；获取偏机构席位、体验偏旧；`[公开]` 未见证据目录证明目的专项闭环 |
| 法律 AI | 法天使 | `[访谈]` 准确率相对更高；律所常 1 账号扫码抢登导致少用 |

**差异化切入**  
只做证据目录「证明目的」：事实绑定短句 + 引用可核验（待核/已核）+ 对照修订 + 律师点确认才定稿。

---

## 三、需求与范围

**优先级**  
| 级 | 需求 |
|----|------|
| P0 | 选证据/待证事实 → 生成证明目的；引用核对原文；待核阻断定稿；对照修订；律师确认；定稿导出=确认版 |
| P0 | 摄像头/相册导入（**模拟 OCR** 明示）+ 预置样例 |
| P1 | 脱敏、原文核对增强、目录骨架导出、对方证据三性质证草稿 |
| P2 | 复杂案时间线、录音转写、类案策略 |

**主流程**  
建案 → 选/扫证据 → 选待证事实 → 生成 → 核验(待核) → 对照修订 → **律师确认** → 导出定稿

**不做**  
一键起诉状/答辩状可上庭；AI 直接改卷宗原文；全案材料自动整理当主卖点。

---

## 四、第1周作业提交（可点击入口）

| 要求 | 可点击入口 |
|------|------------|
| 产品功能清单 | [docs/product-feature-list.md](https://github.com/huohuo808/huohuo/blob/cursor/zhengmu-mvp-demo-bd2f/docs/product-feature-list.md) |
| 产品原型 | [走查 docs/prototype-walkthrough.md](https://github.com/huohuo808/huohuo/blob/cursor/zhengmu-mvp-demo-bd2f/docs/prototype-walkthrough.md) · [截图 docs/media-prototype/](https://github.com/huohuo808/huohuo/tree/cursor/zhengmu-mvp-demo-bd2f/docs/media-prototype) |
| 需求文档 | [docs/requirements-prd.md](https://github.com/huohuo808/huohuo/blob/cursor/zhengmu-mvp-demo-bd2f/docs/requirements-prd.md) |
| MVP Demo（APP） | [zhengmu-mvp/](https://github.com/huohuo808/huohuo/tree/cursor/zhengmu-mvp-demo-bd2f/zhengmu-mvp)（Expo） |

**本交付 Word（请用直链下载，避免空文件）**  
https://github.com/huohuo808/huohuo/raw/cursor/zhengmu-mvp-demo-bd2f/docs/week2-homework-delivery.docx

**Demo 本地打开**

```bash
cd zhengmu-mvp && npm i && npm run check && npx expo start
# 手机 Expo Go 扫码（竖屏）
```

**其他链接**  
- PR：https://github.com/huohuo808/huohuo/pull/2  
- HTML：https://htmlpreview.github.io/?https://github.com/huohuo808/huohuo/blob/cursor/zhengmu-mvp-demo-bd2f/zhengmu-web/index.html  
- 样例案：交通事故人伤（`zhengmu-mvp/demo-case/`）  
- 竞品详表（带来源标注）：[docs/competitive-analysis.md](https://github.com/huohuo808/huohuo/blob/cursor/zhengmu-mvp-demo-bd2f/docs/competitive-analysis.md)
