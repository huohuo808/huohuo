/**
 * 证目 MVP — 线性流程图原型
 * 触达/建案 → 证据组 → 待证事实 → 生成证明目的 → 引用核验(待核) → 对照修订 → 律师确认 → 导出
 */

const STEPS = [
  { id: "reach", label: "触达/建案", short: "建案" },
  { id: "evidence", label: "证据组", short: "证据" },
  { id: "facts", label: "待证事实", short: "事实" },
  { id: "generate", label: "生成证明目的", short: "生成" },
  { id: "verify", label: "引用核验", short: "核验" },
  { id: "diff", label: "对照修订", short: "修订" },
  { id: "confirm", label: "律师确认", short: "确认" },
  { id: "export", label: "导出", short: "导出" },
];

const SAMPLE_EVIDENCE = [
  { id: "e1", no: "证据1", name: "交通事故认定书", summary: "2024年3月12日事故；认定被告李某负全部责任。" },
  { id: "e2", no: "证据2", name: "住院病历及出院小结", summary: "2024年3月12日至3月28日住院；右胫腓骨骨折等。" },
  { id: "e3", no: "证据3", name: "医疗费票据及费用清单", summary: "住院医疗费合计人民币 48,632.50 元。" },
  { id: "e4", no: "证据4", name: "司法鉴定意见书", summary: "2024年6月8日鉴定：右下肢损伤构成十级伤残。" },
  { id: "e5", no: "证据5", name: "后续治疗门诊病历", summary: "出院后复查及康复治疗记录（部分票据日期模糊）。" },
];

const MOCK_PURPOSES = [
  {
    id: "p1",
    evidenceIds: ["e1", "e2", "e4"],
    text: "证明原告于2024年3月12日因交通事故受伤，并于2024年6月8日经法医鉴定构成十级伤残。",
    facts: ["日期：2024-03-12", "鉴定日：2024-06-08", "伤残：十级"],
    draftClient: "该组证据充分证明了原告因为被告的过错发生交通事故从而受伤并且经过鉴定构成了伤残等级这一基本事实，依法应当得到赔偿。",
    suggestion: "证明原告于2024年3月12日因交通事故受伤，并于2024年6月8日经法医鉴定构成十级伤残。",
    suggestionHtml: "证明原告于<ins>2024年3月12日</ins>因交通事故受伤，并于<ins>2024年6月8日</ins>经法医鉴定构成<ins>十级伤残</ins>。<del>（删除空泛论述）</del>",
    citation: {
      status: "verified",
      label: "《道路交通安全法》第76条",
      source: "国家法律法规数据库",
      path: "法律 > 道路交通安全法 > 第七十六条",
      note: "机动车交通事故造成人身伤亡的，由保险公司在交强险责任限额内赔偿；不足部分按过错分担。",
      verifiedAt: "2026-11-21",
    },
  },
  {
    id: "p2",
    evidenceIds: ["e2", "e3"],
    text: "证明原告因本次事故住院治疗，医疗费合计人民币48,632.50元。",
    facts: ["金额：¥48,632.50", "住院：2024-03-12至03-28"],
    draftClient: "证明原告产生了高额医疗费用，被告应当全额赔偿原告的全部医疗损失及相关费用。",
    suggestion: "证明原告因本次事故住院治疗，医疗费合计人民币48,632.50元。",
    suggestionHtml: "证明原告因本次事故住院治疗，医疗费合计人民币<ins>48,632.50</ins>元。<del>（删除「高额」「全额」等主观措辞）</del>",
    citation: {
      status: "verified",
      label: "《民法典》第1179条",
      source: "国家法律法规数据库",
      path: "法律 > 民法典 > 第一千一百七十九条",
      note: "侵害他人造成人身损害的，应当赔偿医疗费等为治疗和康复支出的合理费用。",
      verifiedAt: "2026-11-21",
    },
  },
  {
    id: "p3",
    evidenceIds: ["e2", "e5"],
    text: "证明原告诊疗经过及后续治疗与本次交通事故损伤具有关联性。",
    facts: ["关联性", "后续治疗"],
    draftClient: "根据《最高人民法院关于审理道路交通事故损害赔偿案件适用法律若干问题的解释》第××条，后续治疗费用应当予以支持。",
    suggestion: "证明原告诊疗经过及后续治疗与本次交通事故损伤具有关联性。",
    suggestionHtml: "证明原告诊疗经过及后续治疗与本次交通事故损伤具有关联性。<del>（原客户稿引用条号无法核验，已改为待核并收紧表述）</del>",
    citation: {
      status: "pending",
      label: "《道交损害赔偿司法解释》具体条款",
      source: null,
      path: null,
      note: "客户稿写「第××条」，库中无法匹配条文原文。已标「待核」，禁止伪装为已确认。",
      verifiedAt: null,
    },
  },
];

const state = {
  active: "reach",
  farthest: 0,
  generated: false,
  evidence: structuredClone(SAMPLE_EVIDENCE),
  purposes: [],
  decisions: {},
  editedTexts: {},
  lawyerOk: false,
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const stepIndex = (id) => STEPS.findIndex((s) => s.id === id);

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function openStep(id, { force = false } = {}) {
  const i = stepIndex(id);
  if (!force && i > state.farthest + 1) return;
  // Gate: generate before verify+
  if (["verify", "diff", "confirm", "export"].includes(id) && !state.generated) {
    runGenerate(() => openStep(id, { force: true }));
    return;
  }
  state.active = id;
  state.farthest = Math.max(state.farthest, i);
  render();
  const node = document.getElementById(`node-${id}`);
  if (node) node.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function runGenerate(after) {
  state.purposes = structuredClone(MOCK_PURPOSES);
  state.decisions = {};
  state.editedTexts = {};
  state.generated = true;
  state.lawyerOk = false;
  state.farthest = Math.max(state.farthest, stepIndex("generate"));
  if (after) after();
  else openStep("generate", { force: true });
}

function finalText(p) {
  const d = state.decisions[p.id];
  if (d === "reject") return p.draftClient;
  if (d === "edit") return state.editedTexts[p.id] || p.suggestion;
  return p.suggestion;
}

function buildExportText() {
  const caseName = $("#case-name")?.value || "张某诉李某、某保险公司机动车交通事故责任纠纷";
  const caseType = $("#case-type")?.selectedOptions?.[0]?.textContent || "机动车交通事故责任纠纷 · 人伤";
  const lines = [
    "证据目录 · 证明目的（证目导出）",
    `案件：${caseName}`,
    `案由：${caseType}`,
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
  return lines.join("\n");
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

function summaryFor(id) {
  switch (id) {
    case "reach":
      return "交通事故人伤模板";
    case "evidence":
      return `${state.evidence.length} 组证据`;
    case "facts":
      return "3 项待证事实";
    case "generate":
      return state.generated ? `${state.purposes.length} 条短句` : "待生成";
    case "verify": {
      if (!state.generated) return "待生成后核验";
      const pending = state.purposes.filter((p) => p.citation.status === "pending").length;
      return `${pending} 条待核`;
    }
    case "diff": {
      const n = Object.keys(state.decisions).length;
      return state.generated ? `已处理 ${n}/${state.purposes.length}` : "待修订";
    }
    case "confirm":
      return state.lawyerOk ? "已勾选终审" : "待律师确认";
    case "export":
      return state.lawyerOk ? "可导出段落" : "确认后解锁";
    default:
      return "";
  }
}

function bodyFor(id) {
  switch (id) {
    case "reach":
      return `
        <p class="lede">诉讼律师打开「证目」，选择案由模板新建案件。产品边界：只做证明目的建议稿，不做一键可上庭文书。</p>
        <div class="grid-2">
          <div class="panel-mini">
            <h3>案件信息</h3>
            <label class="toggle"><input type="checkbox" id="desensitize" checked /><span>脱敏分析</span></label>
            <label class="field"><span>案由模板</span>
              <select id="case-type">
                <option value="traffic" selected>机动车交通事故责任纠纷 · 人伤</option>
                <option value="contract">买卖合同纠纷</option>
                <option value="labor">劳动争议 · 工伤</option>
              </select>
            </label>
            <label class="field"><span>案件名称</span>
              <input id="case-name" type="text" value="张某诉李某、某保险公司机动车交通事故责任纠纷" />
            </label>
          </div>
          <div class="boundary-note">
            <strong>产品边界</strong><br/>
            「AI 没有办法帮人担责。」证目只出可核验建议；终审权始终在主办律师。
          </div>
        </div>
        <div class="cta-row" style="margin-top:0.9rem">
          <button class="btn primary" data-next="evidence" type="button">载入样例并进入证据组</button>
        </div>`;

    case "evidence":
      return `
        <p class="lede">导入或勾选证据组摘要。演示数据对齐交通事故人伤证据目录常见结构。</p>
        <ul class="evidence-list">
          ${state.evidence
            .map(
              (e) => `<li class="evidence-card"><div class="row"><strong>${e.no}　${e.name}</strong></div><p>${e.summary}</p></li>`
            )
            .join("")}
        </ul>
        <div class="cta-row" style="margin-top:0.85rem">
          <button class="btn tiny ghost" id="btn-add-evidence" type="button">+ 添加证据</button>
          <button class="btn primary" data-next="facts" type="button">下一步：待证事实</button>
        </div>`;

    case "facts":
      return `
        <p class="lede">对齐争议焦点 / 待证事实，便于证明目的绑定日期与金额，而非空泛论述。</p>
        <label class="field"><span>待证事实 / 争议焦点</span>
          <textarea id="facts" rows="5">1. 原告因本次交通事故受伤并经法医鉴定构成伤残；
2. 原告住院治疗产生的医疗费数额及必要性；
3. 原告诊疗经过与后续治疗关联性。</textarea>
        </label>
        <div class="cta-row">
          <button class="btn primary" data-next="generate" type="button">下一步：生成证明目的</button>
        </div>`;

    case "generate": {
      if (!state.generated) {
        return `
          <p class="lede">根据证据组与待证事实，生成简洁、事实绑定的证明目的短句列表（Mock AI）。</p>
          <div class="cta-row">
            <button class="btn primary" id="btn-generate" type="button">生成证明目的</button>
          </div>`;
      }
      return `
        <p class="lede">已生成 ${state.purposes.length} 条短句。下步进入引用核验——无出处标「待核」。</p>
        <ul class="purpose-list">
          ${state.purposes
            .map(
              (p, i) => `<li class="purpose-card"><h3>${i + 1}. ${escapeHtml(p.text)}</h3>
              <p class="purpose-body">对应：${p.evidenceIds
                .map((id) => state.evidence.find((e) => e.id === id)?.name)
                .join("、")}</p>
              <div class="cite-row">${p.facts.map((f) => `<span class="fact-chip">${f}</span>`).join("")}</div></li>`
            )
            .join("")}
        </ul>
        <div class="cta-row" style="margin-top:0.85rem">
          <button class="btn primary" data-next="verify" type="button">下一步：引用核验</button>
        </div>`;
    }

    case "verify": {
      const verified = state.purposes.filter((p) => p.citation.status === "verified").length;
      const pending = state.purposes.filter((p) => p.citation.status === "pending").length;
      return `
        <p class="lede">每条引用带来源或核验路径；无出处标「待核」，不得伪装为已确认。</p>
        <div class="status-bar">
          <span><strong>${state.purposes.length}</strong> 条</span>
          <span class="ok"><strong>${verified}</strong> 已核验</span>
          <span class="warn"><strong>${pending}</strong> 待核</span>
        </div>
        <ul class="purpose-list">
          ${state.purposes
            .map((p, i) => {
              const isPending = p.citation.status === "pending";
              return `<li class="purpose-card ${isPending ? "pending" : ""}">
                <div class="purpose-top">
                  <h3>${i + 1}. ${escapeHtml(p.text)}</h3>
                  ${isPending ? '<span class="pill warn">待核</span>' : '<span class="pill ok">已核验</span>'}
                </div>
                <div class="cite-row">
                  <span style="font-size:0.82rem;color:var(--muted)">${p.citation.label}</span>
                  <button class="btn tiny ${isPending ? "warn-outline" : "ok-outline"}" data-cite="${p.id}" type="button">
                    ${isPending ? "查看待核原因" : "核验引用"}
                  </button>
                </div>
              </li>`;
            })
            .join("")}
        </ul>
        <div class="cta-row" style="margin-top:0.85rem">
          <button class="btn primary" data-next="diff" type="button">下一步：对照修订</button>
        </div>`;
    }

    case "diff":
      return `
        <p class="lede">左侧客户稿 / AI 初稿，右侧证目建议稿。接受、改写或保留——律师保留终审权。</p>
        <div class="cta-row" style="margin-bottom:0.65rem">
          <button class="btn tiny" id="btn-accept-all" type="button">全部接受建议</button>
          <button class="btn tiny ghost" id="btn-reset-diff" type="button">重置决定</button>
          <span class="hint" style="margin:0">已处理 ${Object.keys(state.decisions).length} / ${state.purposes.length}</span>
        </div>
        <div class="diff-list">
          ${state.purposes
            .map((p, idx) => {
              const decision = state.decisions[p.id];
              const edited = state.editedTexts[p.id];
              const cls = decision
                ? decision === "edit"
                  ? " edited"
                  : decision === "accept"
                    ? " accepted"
                    : " rejected"
                : "";
              return `<article class="diff-card${cls}" data-id="${p.id}">
                <div class="purpose-top">
                  <h3>第 ${idx + 1} 条</h3>
                  ${
                    p.citation.status === "pending"
                      ? '<span class="pill warn">含待核引用</span>'
                      : '<span class="pill ok">引用已核验</span>'
                  }
                </div>
                <div class="diff-grid">
                  <div class="diff-col"><div class="diff-label">客户稿 / AI 初稿</div><p class="diff-text">${escapeHtml(p.draftClient)}</p></div>
                  <div class="diff-col suggest"><div class="diff-label">证目建议稿</div><p class="diff-text">${
                    edited ? escapeHtml(edited) : p.suggestionHtml
                  }</p></div>
                </div>
                <div class="diff-actions">
                  <button class="btn tiny primary" data-decide="accept" data-id="${p.id}" type="button">接受建议</button>
                  <button class="btn tiny ghost" data-decide="edit" data-id="${p.id}" type="button">改写</button>
                  <button class="btn tiny ghost" data-decide="reject" data-id="${p.id}" type="button">保留原稿</button>
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
                    ? `<label class="field" style="margin-top:0.65rem"><span>律师改写</span>
                       <textarea data-edit="${p.id}" rows="2">${escapeHtml(edited || p.suggestion)}</textarea></label>`
                    : ""
                }
              </article>`;
            })
            .join("")}
        </div>
        <div class="cta-row" style="margin-top:0.85rem">
          <button class="btn primary" id="btn-to-confirm" type="button">下一步：律师确认</button>
        </div>`;

    case "confirm":
      return `
        <p class="lede">导出前必须由主办律师确认。AI 不承担法律责任。</p>
        <ul class="check-list">
          ${state.purposes
            .map((p, idx) => {
              const d = state.decisions[p.id] || "accept";
              const label =
                d === "accept" ? "已接受建议" : d === "reject" ? "保留原稿" : "律师改写";
              const cite =
                p.citation.status === "pending"
                  ? '<span class="pill warn">待核</span>'
                  : '<span class="pill ok">已核验</span>';
              return `<li><span>${idx + 1}. ${label}</span>${cite}</li>`;
            })
            .join("")}
        </ul>
        <label class="confirm-box">
          <input type="checkbox" id="lawyer-confirm" ${state.lawyerOk ? "checked" : ""} />
          <span>我已核验引用与表述，确认本证明目的段落可由本人贴入证据目录模板使用。AI 不承担法律责任。</span>
        </label>
        <div class="cta-row">
          <button class="btn primary" data-next="export" type="button" ${state.lawyerOk ? "" : "disabled"} id="btn-go-export">下一步：导出</button>
        </div>`;

    case "export":
      return `
        <p class="lede">导出内容为证据目录「证明目的」段落，便于贴入所内 Word/表格模板——不是可上庭整套文书。</p>
        <div class="cta-row">
          <button class="btn primary" id="btn-export" type="button" ${state.lawyerOk ? "" : "disabled"}>导出证据目录段落</button>
          <button class="btn ghost" id="btn-copy" type="button" ${state.lawyerOk ? "" : "disabled"}>复制到剪贴板</button>
        </div>
        <p class="hint" id="export-msg">${state.lawyerOk ? "" : "请先在「律师确认」节点勾选终审声明。"}</p>
        <pre class="export-preview" id="export-preview">${escapeHtml(buildExportText())}</pre>`;

    default:
      return "";
  }
}

function renderSpineH() {
  const cur = stepIndex(state.active);
  $("#spine-h").innerHTML = STEPS.map((s, i) => {
    const cls = [
      state.active === s.id ? "active" : "",
      cur >= 0 && i < cur ? "done" : "",
      cur < 0 && i <= state.farthest ? "done" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `<li class="${cls}">
      <button class="node-btn" type="button" data-open="${s.id}" aria-label="${s.label}">${String(i + 1).padStart(2, "0")}</button>
      <span class="node-label">${s.label}</span>
    </li>`;
  }).join("");
}

function renderSpineV() {
  $("#spine-v").innerHTML = STEPS.map((s, i) => {
    const active = state.active === s.id;
    const done = i < stepIndex(state.active);
    return `<article class="flow-node ${active ? "active" : ""} ${done ? "done" : ""}" id="node-${s.id}">
      <div class="flow-rail" aria-hidden="true"><span class="dot"></span><span class="connector"></span></div>
      <div class="flow-card">
        <button class="flow-card-head" type="button" data-open="${s.id}">
          <span class="step-index">STEP ${String(i + 1).padStart(2, "0")}</span>
          <h2>${s.label}</h2>
          <span class="summary">${summaryFor(s.id)}</span>
          <span class="chevron" aria-hidden="true"></span>
        </button>
        <div class="flow-card-body">${active ? bodyFor(s.id) : ""}</div>
      </div>
    </article>`;
  }).join("");
}

function render() {
  renderSpineH();
  renderSpineV();
}

function bind() {
  document.body.addEventListener("click", (e) => {
    const open = e.target.closest("[data-open]");
    if (open) {
      openStep(open.dataset.open);
      return;
    }
    const next = e.target.closest("[data-next]");
    if (next) {
      if (next.id === "btn-go-export" && !state.lawyerOk) return;
      openStep(next.dataset.next);
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
      render();
      return;
    }
    if (e.target.id === "btn-generate" || e.target.closest("#btn-generate")) {
      runGenerate(() => openStep("generate", { force: true }));
      return;
    }
    if (e.target.id === "btn-accept-all" || e.target.closest("#btn-accept-all")) {
      state.purposes.forEach((p) => {
        state.decisions[p.id] = "accept";
      });
      render();
      return;
    }
    if (e.target.id === "btn-reset-diff" || e.target.closest("#btn-reset-diff")) {
      state.decisions = {};
      state.editedTexts = {};
      render();
      return;
    }
    if (e.target.id === "btn-to-confirm" || e.target.closest("#btn-to-confirm")) {
      state.purposes.forEach((p) => {
        if (!state.decisions[p.id]) state.decisions[p.id] = "accept";
      });
      openStep("confirm");
      return;
    }
    if (e.target.id === "btn-add-evidence" || e.target.closest("#btn-add-evidence")) {
      const n = state.evidence.length + 1;
      state.evidence.push({
        id: `e${Date.now()}`,
        no: `证据${n}`,
        name: "补充证据（演示）",
        summary: "请填写证据名称与摘要要点。",
      });
      render();
      return;
    }
    if (e.target.id === "btn-export" || e.target.closest("#btn-export")) {
      if (!state.lawyerOk) return;
      const blob = new Blob([buildExportText()], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "证目-证明目的导出.txt";
      a.click();
      URL.revokeObjectURL(a.href);
      const msg = $("#export-msg");
      if (msg) msg.textContent = "已导出文本文件。请粘贴至所内模板后由律师本人提交。";
      return;
    }
    if (e.target.id === "btn-copy" || e.target.closest("#btn-copy")) {
      if (!state.lawyerOk) return;
      navigator.clipboard?.writeText(buildExportText()).then(
        () => {
          const msg = $("#export-msg");
          if (msg) msg.textContent = "已复制到剪贴板。";
        },
        () => {
          const msg = $("#export-msg");
          if (msg) msg.textContent = "复制失败，请手动选择预览文本。";
        }
      );
      return;
    }
    if (e.target.id === "btn-collapse-all" || e.target.closest("#btn-collapse-all")) {
      // keep active but scroll to overview — collapse by setting active to none visually: reopen reach collapsed? 
      // Spec: collapse all — set active to null-like by using a sentinel; use farthest-only overview
      state.active = "";
      render();
      return;
    }
  });

  document.body.addEventListener("change", (e) => {
    if (e.target.id === "lawyer-confirm") {
      state.lawyerOk = e.target.checked;
      render();
    }
  });

  document.body.addEventListener("input", (e) => {
    const ta = e.target.closest("[data-edit]");
    if (ta) state.editedTexts[ta.dataset.edit] = ta.value;
  });
}

bind();
render();
