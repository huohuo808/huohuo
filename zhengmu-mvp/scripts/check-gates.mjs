/**
 * Node smoke checks for roadshow export/confirm gates.
 * Run: node scripts/check-gates.mjs
 */
import assert from "node:assert/strict";
import {
  purposesForSelection,
  hasPendingCitation,
  canExportFinal,
  sessionFingerprint,
  buildExportText,
} from "../src/gates.js";

const purposes = [
  {
    id: "p2",
    evidenceIds: ["e2", "e3"],
    suggestion: "证明医疗费合计人民币48,632.50元。",
    draftClient: "高额医疗费应全赔。",
    citation: { status: "verified", label: "民法典1179" },
  },
  {
    id: "p3",
    evidenceIds: ["e2", "e5"],
    suggestion: "证明关联性。",
    draftClient: "司法解释第××条",
    citation: { status: "pending", label: "待核条款" },
  },
];

const evidence = [
  { id: "e2", no: "证据2", name: "病历", summary: "住院", amount: null },
  { id: "e3", no: "证据3", name: "票据", summary: "医疗费 48632.50", amount: 48632.5 },
  { id: "e5", no: "证据5", name: "门诊", summary: "后续", amount: null },
];

// select e2+e3 → only p2
const one = purposesForSelection(purposes, ["e2", "e3"]);
assert.equal(one.length, 1);
assert.equal(one[0].id, "p2");

assert.equal(hasPendingCitation(purposes), true);
assert.equal(hasPendingCitation(one), false);

const base = {
  evidence,
  selectedEvidenceIds: ["e2", "e3"],
  facts: "医疗费",
  selectedFacts: ["f1"],
  decisions: { p2: "accept" },
  editedTexts: {},
  purposes: one,
};
const fp1 = sessionFingerprint(base);

let gate = canExportFinal({
  lawyerOk: true,
  hasPending: false,
  fingerprint: fp1,
  confirmedFingerprint: fp1,
});
assert.equal(gate.ok, true);

// change amount → fingerprint changes → old confirm invalid
const evidence2 = evidence.map((e) => (e.id === "e3" ? { ...e, amount: 50000, summary: "医疗费 50000" } : e));
const fp2 = sessionFingerprint({ ...base, evidence: evidence2 });
assert.notEqual(fp1, fp2);
gate = canExportFinal({
  lawyerOk: true,
  hasPending: false,
  fingerprint: fp2,
  confirmedFingerprint: fp1,
});
assert.equal(gate.ok, false);
assert.match(gate.reason, /失效/);

// pending blocks final export
gate = canExportFinal({
  lawyerOk: true,
  hasPending: true,
  fingerprint: fp1,
  confirmedFingerprint: fp1,
});
assert.equal(gate.ok, false);
assert.match(gate.reason, /待核/);

// export text equals decision version
const decisionsEdit = { p2: "edit" };
const edited = { p2: "证明医疗费合计人民币50,000元。" };
const text = buildExportText({
  purposes: one,
  caseName: "案",
  caseType: "人伤",
  evidence,
  decisions: decisionsEdit,
  editedTexts: edited,
  mode: "final",
});
assert.match(text, /50,000/);
assert.doesNotMatch(text, /48,632\.50元。\n引用/);

console.log("check-gates: OK");
