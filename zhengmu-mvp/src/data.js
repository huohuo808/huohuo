/**
 * Demo case pack — kept in sync with demo-case/ and docs/demo-case/
 * 交通事故人伤样例；App Mock 与路演数据包一致。
 */
import casePack from "../demo-case/evidence-list.json";
import mockPurposes from "../demo-case/mock-purposes.json";

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

export const SAMPLE_EVIDENCE = casePack.evidenceGroups.map((e) => ({
  id: e.id,
  no: e.no,
  name: e.name,
  summary: e.summary,
  date: e.date,
  amount: e.amount,
  sourceNote: e.sourceNote || "",
  source: "preset",
  originalSnippet: [e.sourceNote, e.summary, e.amount != null ? `金额：¥${Number(e.amount).toFixed(2)}` : null]
    .filter(Boolean)
    .join("｜"),
}));

export const MOCK_PURPOSES = mockPurposes;

export const DEFAULT_CASE_NAME = casePack.caseName;
export const DEFAULT_CASE_TYPE = casePack.causeOfAction;
export const FACT_OPTIONS = casePack.factsToProve.map((f, i) => ({
  id: `f${i + 1}`,
  label: f,
}));
export const DEFAULT_FACTS = FACT_OPTIONS.map((f, i) => `${i + 1}. ${f.label}`).join("\n");

export const DEMO_CASE_META = {
  caseId: casePack.caseId,
  causeOfAction: casePack.causeOfAction,
  desensitized: casePack.desensitized,
};
