export const STEPS = [
  { id: "reach", label: "建案", short: "建案" },
  { id: "evidence", label: "证据组", short: "证据" },
  { id: "facts", label: "待证事实", short: "事实" },
  { id: "generate", label: "生成证明目的", short: "生成" },
  { id: "verify", label: "引用核验", short: "核验" },
  { id: "diff", label: "对照修订", short: "修订" },
  { id: "confirm", label: "律师确认", short: "确认" },
  { id: "export", label: "导出", short: "导出" },
];

export const SAMPLE_EVIDENCE = [
  { id: "e1", no: "证据1", name: "交通事故认定书", summary: "2024年3月12日事故；认定被告李某负全部责任。" },
  { id: "e2", no: "证据2", name: "住院病历及出院小结", summary: "2024年3月12日至3月28日住院；右胫腓骨骨折等。" },
  { id: "e3", no: "证据3", name: "医疗费票据及费用清单", summary: "住院医疗费合计人民币 48,632.50 元。" },
  { id: "e4", no: "证据4", name: "司法鉴定意见书", summary: "2024年6月8日鉴定：右下肢损伤构成十级伤残。" },
  { id: "e5", no: "证据5", name: "后续治疗门诊病历", summary: "出院后复查及康复治疗记录（部分票据日期模糊）。" },
];

export const MOCK_PURPOSES = [
  {
    id: "p1",
    evidenceIds: ["e1", "e2", "e4"],
    text: "证明原告于2024年3月12日因交通事故受伤，并于2024年6月8日经法医鉴定构成十级伤残。",
    facts: ["日期：2024-03-12", "鉴定日：2024-06-08", "伤残：十级"],
    draftClient:
      "该组证据充分证明了原告因为被告的过错发生交通事故从而受伤并且经过鉴定构成了伤残等级这一基本事实，依法应当得到赔偿。",
    suggestion:
      "证明原告于2024年3月12日因交通事故受伤，并于2024年6月8日经法医鉴定构成十级伤残。",
    citation: {
      status: "verified",
      label: "《道路交通安全法》第76条",
      source: "国家法律法规数据库",
      path: "法律 > 道路交通安全法 > 第七十六条",
      note: "机动车交通事故造成人身伤亡的，由保险公司在交强险责任限额内赔偿；不足部分按过错分担。",
    },
  },
  {
    id: "p2",
    evidenceIds: ["e2", "e3"],
    text: "证明原告因本次事故住院治疗，医疗费合计人民币48,632.50元。",
    facts: ["金额：¥48,632.50", "住院：2024-03-12至03-28"],
    draftClient: "证明原告产生了高额医疗费用，被告应当全额赔偿原告的全部医疗损失及相关费用。",
    suggestion: "证明原告因本次事故住院治疗，医疗费合计人民币48,632.50元。",
    citation: {
      status: "verified",
      label: "《民法典》第1179条",
      source: "国家法律法规数据库",
      path: "法律 > 民法典 > 第一千一百七十九条",
      note: "侵害他人造成人身损害的，应当赔偿医疗费等为治疗和康复支出的合理费用。",
    },
  },
  {
    id: "p3",
    evidenceIds: ["e2", "e5"],
    text: "证明原告诊疗经过及后续治疗与本次交通事故损伤具有关联性。",
    facts: ["关联性", "后续治疗"],
    draftClient:
      "根据《最高人民法院关于审理道路交通事故损害赔偿案件适用法律若干问题的解释》第××条，后续治疗费用应当予以支持。",
    suggestion: "证明原告诊疗经过及后续治疗与本次交通事故损伤具有关联性。",
    citation: {
      status: "pending",
      label: "《道交损害赔偿司法解释》具体条款",
      source: null,
      path: null,
      note: "客户稿写「第××条」，库中无法匹配条文原文。已标「待核」，禁止伪装为已确认。",
    },
  },
];

export const DEFAULT_CASE_NAME = "张某诉李某、某保险公司机动车交通事故责任纠纷";
export const DEFAULT_FACTS = `1. 原告因本次交通事故受伤并经法医鉴定构成伤残；
2. 原告住院治疗产生的医疗费数额及必要性；
3. 原告诊疗经过与后续治疗关联性。`;
