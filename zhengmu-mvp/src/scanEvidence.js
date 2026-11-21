/** Demo-only mock OCR guesses when user scans evidence with the phone camera. */
export const SCAN_TEMPLATES = [
  {
    name: "扫描件 · 责任认定书片段",
    summary: "【模拟 OCR】事故日期约 2024-03-12；疑似含「全部责任」字样。非真实识别，请人工核对原文。",
  },
  {
    name: "扫描件 · 医疗费票据",
    summary: "【模拟 OCR】票据金额疑似 ¥48,632.50；开票单位含「医院」。非真实识别，请人工核对原文。",
  },
  {
    name: "扫描件 · 鉴定意见书封面",
    summary: "【模拟 OCR】鉴定日期约 2024-06-08；伤残等级疑似「十级」。非真实识别，请人工核对原文。",
  },
  {
    name: "扫描件 · 病历首页",
    summary: "【模拟 OCR】住院起止约 2024-03-12 至 03-28；诊断含骨折相关表述。非真实识别，请人工核对原文。",
  },
];

export function buildScannedEvidence(existingCount, uri, templateIndex) {
  const t = SCAN_TEMPLATES[templateIndex % SCAN_TEMPLATES.length];
  const n = existingCount + 1;
  return {
    id: `scan-${Date.now()}`,
    no: `证据${n}`,
    name: t.name,
    summary: t.summary,
    source: "camera",
    ocrMock: true,
    uri: uri || null,
    originalSnippet: `【模拟 OCR 草稿】${t.summary}`,
    sourceNote: "手机摄像头扫描（演示）",
  };
}
