/**
 * 证目 MVP Demo — mock AI workflow for 证明目的
 * Sample: 交通事故人伤证据目录
 */

const SAMPLE_EVIDENCE = [
  {
    id: "e1",
    no: "证据1",
    name: "交通事故认定书",
    summary: "2024年3月12日事故；认定被告李某负全部责任。",
  },
  {
    id: "e2",
    no: "证据2",
    name: "住院病历及出院小结",
    summary: "2024年3月12日至3月28日住院治疗；诊断为右胫腓骨骨折等。",
  },
  {
    id: "e3",
    no: "证据3",
    name: "医疗费票据及费用清单",
    summary: "住院医疗费合计人民币 48,632.50 元。",
  },
  {
    id: "e4",
    no: "证据4",
    name: "司法鉴定意见书",
    summary: "2024年6月8日鉴定：右下肢损伤构成十级伤残。",
  },
  {
    id: "e5",
    no: "证据5",
    name: "后续治疗门诊病历",
    summary: "出院后复查及康复治疗记录（部分票据日期模糊）。",
  },
];

/** Mock generated 证明目的 with citations */
const MOCK_PURPOSES = [
  {
    id: "p1",
    evidenceIds: ["e1", "e2", "e4"],
    text: "证明原告于2024年3月12日因交通事故受伤，并于2024年6月8日经法医鉴定构成十级伤残。",
    facts: ["日期：2024-03-12", "鉴定日：2024-06-08", "伤残：十级"],
    draftClient:
      "该组证据充分证明了原告因为被告的过错发生交通事故从而受伤并且经过鉴定构成了伤残等级这一基本事实，依法应当得到赔偿。",
    suggestion:
      "证明原告于2024年3月12日因交通事故受伤，并于2024年6月8日经法医鉴定构成十级伤残。",
    suggestionHtml:
      "证明原告于<ins>2024年3月12日</ins>因交通事故受伤，并于<ins>2024年6月8日</ins>经法医鉴定构成<ins>十级伤残</ins>。<del>（删除空泛论述）</del>",
    citation: {
      status: "verified",
      label: "《道路交通安全法》第76条",
      source: "国家法律法规数据库",
      path: "法律 > 道路交通安全法 > 第七十六条",
      note: "机动车发生交通事故造成人身伤亡、财产损失的，由保险公司在交强险责任限额范围内予以赔偿；不足部分按过错分担。",
      verifiedAt: "2026-11-21",
    },
  },
  {
    id: "p2",
    evidenceIds: ["e2", "e3"],
    text: "证明原告因本次事故住院治疗，医疗费合计人民币48,632.50元。",
    facts: ["金额：¥48,632.50", "住院：2024-03-12至03-28"],
    draftClient:
      "证明原告产生了高额医疗费用，被告应当全额赔偿原告的全部医疗损失及相关费用。",
    suggestion:
      "证明原告因本次事故住院治疗，医疗费合计人民币48,632.50元。",
    suggestionHtml:
      "证明原告因本次事故住院治疗，医疗费合计人民币<ins>48,632.50</ins>元。<del>（删除「高额」「全额」等主观措辞）</del>",
    citation: {
      status: "verified",
      label: "《民法典》第1179条",
      source: "国家法律法规数据库",
      path: "法律 > 民法典 > 第一千一百七十九条",
      note: "侵害他人造成人身损害的，应当赔偿医疗费、护理费、交通费等为治疗和康复支出的合理费用。",
      verifiedAt: "2026-11-21",
    },
  },
  {
    id: "p3",
    evidenceIds: ["e2", "e5"],
    text: "证明原告诊疗经过及后续治疗与本次交通事故损伤具有关联性。",
    facts: ["关联性", "后续治疗"],
    draftClient:
      "根据《最高人民法院关于审理道路交通事故损害赔偿案件适用法律若干问题的解释》第××条，后续治疗费用应当予以支持。",
    suggestion:
      "证明原告诊疗经过及后续治疗与本次交通事故损伤具有关联性。",
    suggestionHtml:
      "证明原告诊疗经过及后续治疗与本次交通事故损伤具有关联性。<del>（原客户稿引用条号无法核验，已改为待核并收紧表述）</del>",
    citation: {
      status: "pending",
      label: "《道交损害赔偿司法解释》具体条款",
      source: null,
      path: null,
      note: "客户稿写「第××条」，库中无法匹配到明确条款原文。已标「待核」，请律师手工核验或改引已确认条文后再定稿。",
      verifiedAt: null,
    },
  },
];

const state = {
  screen: "home",
  evidence: structuredClone(SAMPLE_EVIDENCE),
  purposes: [],
  decisions: {}, // id -> accept | reject | edit
  editedTexts: {},
  generated: false,
  confirmed: false,
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function go(screen) {
  state.screen = screen;
  $$(".screen").forEach((el) => el.classList.toggle("active", el.dataset.screen === screen));
  $$(".step").forEach((el) => {
    const order = ["home", "intake", "result", "diff", "confirm"];
    const i = order.indexOf(el.dataset.step);
    const cur = order.indexOf(screen);
    el.classList.toggle("active", el.dataset.step === screen);
    el.classList.toggle("done", i < cur);
  });
  if (screen === "result") renderPurposes();
  if (screen === "diff") renderDiff();
  if (screen === "confirm") renderConfirm();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderEvidence() {
  const list = $("#evidence-list");
  list.innerHTML = state.evidence
    .map(
      (e) => `
    <article class="evidence-card" data-id="${e.id}">
      <div class="row">
        <strong>${e.no}　${e.name}</strong>
        <span class="meta">可勾选入组</span>
      </div>
      <p>${e.summary}</p>
    </article>`
    )
    .join("");
}

function generate() {
  // Simulate brief "AI" work
  const btn = $("#btn-generate");
  const prev = btn.textContent;
  btn.disabled = true;
  btn.textContent = "生成中…";
  setTimeout(() => {
    state.purposes = structuredClone(MOCK_PURPOSES);
    state.decisions = {};
    state.editedTexts = {};
    state.generated = true;
    state.confirmed = false;
    $("#lawyer-confirm").checked = false;
    btn.disabled = false;
    btn.textContent = prev;
    go("result");
  }, 650);
}

function renderPurposes() {
  const verified = state.purposes.filter((p) => p.citation.status === "verified").length;
  const pending = state.purposes.filter((p) => p.citation.status === "pending").length;
  $("#stat-total").textContent = String(state.purposes.length);
  $("#stat-verified").textContent = String(verified);
  $("#stat-pending").textContent = String(pending);

  $("#purpose-list").innerHTML = state.purposes
    .map((p, idx) => {
      const isPending = p.citation.status === "pending";
      const cites = p.facts.map((f) => `<span class="fact-chip">${f}</span>`).join("");
      const statusPill = isPending
        ? `<span class="pill warn">待核</span>`
        : `<span class="pill ok">已核验</span>`;
      const citeBtn = isPending
        ? `<button class="btn tiny warn-outline" data-cite="${p.id}" type="button">查看待核原因</button>`
        : `<button class="btn tiny ok-outline" data-cite="${p.id}" type="button">核验引用</button>`;
      return `
      <article class="purpose-card ${isPending ? "pending" : ""}">
        <div class="purpose-top">
          <h3>${idx + 1}. ${p.text}</h3>
          ${statusPill}
        </div>
        <p class="purpose-body">对应证据：${p.evidenceIds
          .map((id) => state.evidence.find((e) => e.id === id)?.name || id)
          .join("、")}</p>
        <div class="cite-row">
          ${cites}
          ${citeBtn}
          <span class="meta" style="color:var(--muted);font-size:0.8rem">${p.citation.label}</span>
        </div>
      </article>`;
    })
    .join("");
}

function openCitation(id) {
  const p = state.purposes.find((x) => x.id === id);
  if (!p) return;
  const c = p.citation;
  const pending = c.status === "pending";
  $("#cite-title").textContent = pending ? "引用待核" : "引用核验";
  $("#cite-body").innerHTML = `
    <dl class="cite-meta">
      <div><dt>引用表述</dt><dd>${c.label}</dd></div>
      <div><dt>状态</dt><dd>${
        pending
          ? '<span class="pill warn">待核 — 不得伪装为已确认</span>'
          : '<span class="pill ok">已核验</span>'
      }</dd></div>
      <div><dt>来源</dt><dd>${c.source || "— 无可靠出处 —"}</dd></div>
      <div><dt>核验路径</dt><dd>${c.path || "无法定位到条文原文"}</dd></div>
      <div><dt>说明</dt><dd>${c.note}</dd></div>
      <div><dt>核验时间</dt><dd>${c.verifiedAt || "未完成"}</dd></div>
    </dl>`;
  $("#cite-dialog").showModal();
}

function renderDiff() {
  const list = $("#diff-list");
  list.innerHTML = state.purposes
    .map((p, idx) => {
      const decision = state.decisions[p.id];
      const edited = state.editedTexts[p.id];
      const rightText = edited || p.suggestion;
      const cls = decision ? ` ${decision === "edit" ? "edited" : decision === "accept" ? "accepted" : "rejected"}` : "";
      return `
      <article class="diff-card${cls}" data-id="${p.id}">
        <div class="purpose-top">
          <h3 style="margin:0;font-size:1rem">第 ${idx + 1} 条</h3>
          ${
            p.citation.status === "pending"
              ? '<span class="pill warn">含待核引用</span>'
              : '<span class="pill ok">引用已核验</span>'
          }
        </div>
        <div class="diff-grid">
          <div class="diff-col">
            <div class="diff-label">客户稿 / AI 初稿</div>
            <p class="diff-text">${escapeHtml(p.draftClient)}</p>
          </div>
          <div class="diff-col suggest">
            <div class="diff-label">证目建议稿</div>
            <p class="diff-text">${edited ? escapeHtml(edited) : p.suggestionHtml}</p>
          </div>
        </div>
        <div class="diff-actions">
          <button class="btn tiny primary" data-decide="accept" data-id="${p.id}" type="button"${
        decision === "accept" ? " disabled" : ""
      }>接受建议</button>
          <button class="btn tiny ghost" data-decide="edit" data-id="${p.id}" type="button">改写</button>
          <button class="btn tiny ghost" data-decide="reject" data-id="${p.id}" type="button"${
        decision === "reject" ? " disabled" : ""
      }>保留原稿</button>
          ${
            decision
              ? `<span class="pill soft">已决定：${
                  decision === "accept" ? "接受" : decision === "reject" ? "保留原稿" : "已改写"
                }</span>`
              : ""
          }
        </div>
        ${
          decision === "edit"
            ? `<label class="field" style="margin-top:0.75rem"><span>律师改写</span>
               <textarea data-edit="${p.id}" rows="3">${escapeHtml(rightText)}</textarea></label>`
            : ""
        }
      </article>`;
    })
    .join("");

  const done = Object.keys(state.decisions).length;
  $("#diff-progress").textContent = `已处理 ${done} / ${state.purposes.length}`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function finalText(p) {
  const d = state.decisions[p.id];
  if (d === "reject") return p.draftClient;
  if (d === "edit") return state.editedTexts[p.id] || p.suggestion;
  if (d === "accept") return p.suggestion;
  return p.suggestion;
}

function renderConfirm() {
  const list = $("#confirm-checklist");
  list.innerHTML = state.purposes
    .map((p, idx) => {
      const d = state.decisions[p.id] || "accept（默认建议）";
      const label =
        d === "accept"
          ? "已接受建议"
          : d === "reject"
            ? "保留原稿"
            : d === "edit"
              ? "律师改写"
              : "待对照（将按建议稿）";
      const cite =
        p.citation.status === "pending"
          ? '<span class="pill warn">待核</span>'
          : '<span class="pill ok">已核验</span>';
      return `<li><span>${idx + 1}. ${label}</span>${cite}</li>`;
    })
    .join("");

  const lines = [
    "证据目录 · 证明目的（证目导出）",
    `案件：${$("#case-name").value}`,
    `案由：${$("#case-type").selectedOptions[0].textContent}`,
    "",
    ...state.purposes.map((p, i) => {
      const ev = p.evidenceIds
        .map((id) => state.evidence.find((e) => e.id === id))
        .filter(Boolean)
        .map((e) => e.no)
        .join("、");
      const flag = p.citation.status === "pending" ? "【待核】" : "【已核验】";
      return `${i + 1}. ${ev}\n证明目的：${finalText(p)}\n引用：${p.citation.label} ${flag}`;
    }),
    "",
    "——",
    "声明：本段落经主办律师确认后导出，仅供贴入所内证据目录模板；不构成可上庭整套文书。",
  ];
  $("#export-preview").textContent = lines.join("\n");
  syncExportButtons();
}

function syncExportButtons() {
  const ok = $("#lawyer-confirm").checked;
  $("#btn-export").disabled = !ok;
  $("#btn-copy").disabled = !ok;
}

function exportText() {
  if (!$("#lawyer-confirm").checked) return;
  state.confirmed = true;
  const text = $("#export-preview").textContent;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "证目-证明目的导出.txt";
  a.click();
  URL.revokeObjectURL(a.href);
  $("#export-msg").textContent = "已导出文本文件。请粘贴至所内 Word/表格模板后由律师本人提交。";
}

async function copyText() {
  if (!$("#lawyer-confirm").checked) return;
  try {
    await navigator.clipboard.writeText($("#export-preview").textContent);
    $("#export-msg").textContent = "已复制到剪贴板。";
  } catch {
    $("#export-msg").textContent = "复制失败，请手动选择预览文本。";
  }
}

function bind() {
  document.body.addEventListener("click", (e) => {
    const goEl = e.target.closest("[data-go]");
    if (goEl) {
      const screen = goEl.dataset.go;
      if (goEl.dataset.loadSample) {
        state.evidence = structuredClone(SAMPLE_EVIDENCE);
        renderEvidence();
      }
      if ((screen === "result" || screen === "diff" || screen === "confirm") && !state.generated) {
        generate();
        return;
      }
      go(screen);
      return;
    }

    const step = e.target.closest(".step");
    if (step) {
      const screen = step.dataset.step;
      if ((screen === "result" || screen === "diff" || screen === "confirm") && !state.generated) {
        generate();
        return;
      }
      go(screen);
      return;
    }

    const cite = e.target.closest("[data-cite]");
    if (cite) {
      openCitation(cite.dataset.cite);
      return;
    }

    const decide = e.target.closest("[data-decide]");
    if (decide) {
      const id = decide.dataset.id;
      const action = decide.dataset.decide;
      state.decisions[id] = action;
      if (action === "edit" && !state.editedTexts[id]) {
        state.editedTexts[id] = state.purposes.find((p) => p.id === id).suggestion;
      }
      renderDiff();
      return;
    }
  });

  $("#diff-list").addEventListener("input", (e) => {
    const ta = e.target.closest("[data-edit]");
    if (ta) state.editedTexts[ta.dataset.edit] = ta.value;
  });

  $("#btn-generate").addEventListener("click", generate);
  $("#btn-to-confirm").addEventListener("click", () => {
    // fill undecided as accept for demo continuity, but surface in checklist
    state.purposes.forEach((p) => {
      if (!state.decisions[p.id]) state.decisions[p.id] = "accept";
    });
    go("confirm");
  });
  $("#btn-accept-all").addEventListener("click", () => {
    state.purposes.forEach((p) => {
      state.decisions[p.id] = "accept";
    });
    renderDiff();
  });
  $("#btn-reset-diff").addEventListener("click", () => {
    state.decisions = {};
    state.editedTexts = {};
    renderDiff();
  });
  $("#lawyer-confirm").addEventListener("change", syncExportButtons);
  $("#btn-export").addEventListener("click", exportText);
  $("#btn-copy").addEventListener("click", copyText);
  $("#btn-add-evidence").addEventListener("click", () => {
    const n = state.evidence.length + 1;
    state.evidence.push({
      id: `e${Date.now()}`,
      no: `证据${n}`,
      name: "补充证据（演示）",
      summary: "请填写证据名称与摘要要点。",
    });
    renderEvidence();
  });
}

renderEvidence();
bind();
go("home");
