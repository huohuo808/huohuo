/**
 * Roadshow export / confirm gates — pure helpers (node-testable).
 */

export function evidenceFingerprint(evidence, selectedEvidenceIds) {
  const selected = new Set(selectedEvidenceIds || evidence.map((e) => e.id));
  return evidence
    .filter((e) => selected.has(e.id))
    .map((e) => `${e.id}|${e.no}|${e.name}|${e.summary}|${e.amount ?? ""}|${e.source || "preset"}`)
    .join("||");
}

export function sessionFingerprint({
  evidence,
  selectedEvidenceIds,
  facts,
  selectedFacts,
  decisions,
  editedTexts,
  purposes,
}) {
  return [
    evidenceFingerprint(evidence, selectedEvidenceIds),
    `facts:${facts || ""}`,
    `selFacts:${(selectedFacts || []).join(",")}`,
    `dec:${JSON.stringify(decisions || {})}`,
    `edit:${JSON.stringify(editedTexts || {})}`,
    `pur:${(purposes || []).map((p) => `${p.id}:${p.citation?.status}:${p.suggestion}`).join("|")}`,
  ].join("\n");
}

export function purposesForSelection(allPurposes, selectedEvidenceIds) {
  const sel = new Set(selectedEvidenceIds || []);
  if (!sel.size) return [];
  return allPurposes.filter((p) => (p.evidenceIds || []).every((id) => sel.has(id)));
}

export function hasPendingCitation(purposes) {
  return (purposes || []).some((p) => p.citation?.status === "pending");
}

/** Final export (定稿) requires lawyer confirm + no pending citations + fingerprint match. */
export function canExportFinal({ lawyerOk, hasPending, fingerprint, confirmedFingerprint }) {
  if (!lawyerOk) return { ok: false, reason: "未律师确认" };
  if (hasPending) return { ok: false, reason: "含待核引用，不能导出定稿" };
  if (!confirmedFingerprint || fingerprint !== confirmedFingerprint) {
    return { ok: false, reason: "证据/金额/修订已变更，旧确认已失效" };
  }
  return { ok: true, reason: "" };
}

export function finalPurposeText(p, decisions, editedTexts) {
  const d = decisions?.[p.id];
  if (d === "reject") return p.draftClient;
  if (d === "edit") return editedTexts?.[p.id] || p.suggestion;
  return p.suggestion;
}

export function buildExportText({
  purposes,
  caseName,
  caseType,
  evidence,
  decisions,
  editedTexts,
  mode = "final",
}) {
  if (!purposes?.length) return "（尚未生成证明目的）";
  const title =
    mode === "final"
      ? "证据目录 · 证明目的（证目 Expo App · 定稿导出）"
      : "证据目录 · 证明目的（证目 Expo App · 草稿预览，含待核）";
  return [
    title,
    `案件：${caseName}`,
    `案由：${caseType}`,
    "",
    ...purposes.map((p, i) => {
      const ev = (p.evidenceIds || [])
        .map((id) => evidence.find((e) => e.id === id)?.no)
        .filter(Boolean)
        .join("、");
      const flag = p.citation?.status === "pending" ? "【待核】" : "【已核验】";
      return `${i + 1}. ${ev}\n证明目的：${finalPurposeText(p, decisions, editedTexts)}\n引用：${p.citation?.label || ""} ${flag}`;
    }),
    "",
    "——",
    mode === "final"
      ? "声明：本段落经主办律师确认后导出，仅供贴入所内证据目录模板；不构成可上庭整套文书。"
      : "声明：此为草稿预览。含待核引用时不可作为定稿导出。",
  ].join("\n");
}
