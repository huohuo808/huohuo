const STEPS = [
  { id: "reach", label: "建案" },
  { id: "evidence", label: "证据组" },
  { id: "facts", label: "待证事实" },
  { id: "generate", label: "生成" },
  { id: "verify", label: "核验" },
  { id: "diff", label: "修订" },
  { id: "confirm", label: "确认" },
  { id: "export", label: "导出" },
];

const EVIDENCE = [
  { id: "e1", no: "证据1", name: "交通事故认定书", summary: "2024年3月12日事故；认定被告李某负全部责任。" },
  { id: "e2", no: "证据2", name: "住院病历及出院小结", summary: "2024年3月12日至3月28日住院；右胫腓骨骨折等。" },
  { id: "e3", no: "证据3", name: "医疗费票据及费用清单", summary: "住院医疗费合计人民币 48,632.50 元。" },
  { id: "e4", no: "证据4", name: "司法鉴定意见书", summary: "2024年6月8日鉴定：右下肢损伤构成十级伤残。" },
  { id: "e5", no: "证据5", name: "后续治疗门诊病历", summary: "出院后复查及康复治疗记录（部分票据日期模糊）。" },
];

const PURPOSES = [
  {
    id: "p1",
    text: "证明原告于2024年3月12日因交通事故受伤，并于2024年6月8日经法医鉴定构成十级伤残。",
    facts: ["日期：2024-03-12", "鉴定日：2024-06-08", "伤残：十级"],
    draft: "该组证据充分证明了原告因为被告的过错发生交通事故从而受伤并且经过鉴定构成了伤残等级这一基本事实，依法应当得到赔偿。",
    suggestion: "证明原告于2024年3月12日因交通事故受伤，并于2024年6月8日经法医鉴定构成十级伤残。",
    citation: {
      status: "verified",
      label: "《道路交通安全法》第76条",
      note: "来源：国家法律法规数据库。可核验路径：法律 > 道路交通安全法 > 第七十六条。",
    },
  },
  {
    id: "p2",
    text: "证明原告因本次事故住院治疗，医疗费合计人民币48,632.50元。",
    facts: ["金额：¥48,632.50", "住院：2024-03-12至03-28"],
    draft: "证明原告产生了高额医疗费用，被告应当全额赔偿原告的全部医疗损失及相关费用。",
    suggestion: "证明原告因本次事故住院治疗，医疗费合计人民币48,632.50元。",
    citation: {
      status: "verified",
      label: "《民法典》第1179条",
      note: "来源：国家法律法规数据库。可核验路径：法律 > 民法典 > 第一千一百七十九条。",
    },
  },
  {
    id: "p3",
    text: "证明原告诊疗经过及后续治疗与本次交通事故损伤具有关联性。",
    facts: ["关联性", "后续治疗"],
    draft: "根据《最高人民法院关于审理道路交通事故损害赔偿案件适用法律若干问题的解释》第××条，后续治疗费用应当予以支持。",
    suggestion: "证明原告诊疗经过及后续治疗与本次交通事故损伤具有关联性。",
    citation: {
      status: "pending",
      label: "《道交损害赔偿司法解释》具体条款",
      note: "客户稿写「第××条」，库中无法匹配。已标「待核」，不得伪装为已确认。",
    },
  },
];

const CASE_NAME = "张某诉李某、某保险公司机动车交通事故责任纠纷";
const FACTS = `1. 原告因本次交通事故受伤并经法医鉴定构成伤残；
2. 原告住院治疗产生的医疗费数额及必要性；
3. 原告诊疗经过与后续治疗关联性。`;

const state = {
  step: 0,
  generated: false,
  decisions: {},
  lawyerOk: false,
};

const $ = (s) => document.querySelector(s);

function go(i) {
  state.step = Math.max(0, Math.min(STEPS.length - 1, i));
  if (state.step >= 4 && !state.generated) {
    state.generated = true;
  }
  render();
}

function finalText(p) {
  const d = state.decisions[p.id];
  if (d === "reject") return p.draft;
  return p.suggestion;
}

function exportText() {
  return [
    "证据目录 · 证明目的（证目 HTML 演示导出）",
    `案件：${CASE_NAME}`,
    "案由：机动车交通事故责任纠纷 · 人伤",
    "",
    ...PURPOSES.map((p, i) => {
      const flag = p.citation.status === "pending" ? "【待核】" : "【已核验】";
      return `${i + 1}. ${p.text}\n引用：${p.citation.label} ${flag}`;
    }),
    "",
    "声明：经主办律师确认后导出，仅供贴入所内模板；不构成可上庭整套文书。",
  ].join("\n");
}

function openCite(p) {
  $("#dlg-title").textContent = p.citation.status === "pending" ? "引用待核" : "引用核验";
  $("#dlg-body").innerHTML = `<p><strong>${p.citation.label}</strong></p><p>${p.citation.note}</p>`;
  $("#dlg").showModal();
}

function body() {
  const id = STEPS[state.step].id;
  switch (id) {
    case "reach":
      return `<h2>建案</h2>
        <p>选择案由模板，载入交通事故人伤样例。AI 只出可核验建议稿，终审在律师。</p>
        <div class="card"><h3>${CASE_NAME}</h3><div class="meta">案由：机动车交通事故责任纠纷 · 人伤 · 已脱敏</div></div>
        <div class="card" style="background:#0f5c4c;color:#fff;border:0"><h3 style="color:#fff">产品边界</h3>
        <div class="meta" style="color:rgba(255,255,255,.88)">AI 没有办法帮人担责。不做一键可上庭文书。</div></div>`;
    case "evidence":
      return `<h2>证据组</h2><p>演示用五组证据（含日期与金额）。</p>${EVIDENCE.map(
        (e) => `<div class="card"><h3>${e.no}　${e.name}</h3><div class="meta">${e.summary}</div></div>`
      ).join("")}`;
    case "facts":
      return `<h2>待证事实</h2><p>对齐争议焦点，便于证明目的绑定日期/金额。</p>
        <textarea readonly>${FACTS}</textarea>`;
    case "generate":
      state.generated = true;
      return `<h2>生成证明目的</h2><p>已生成 ${PURPOSES.length} 条短句（Mock）。</p>${PURPOSES.map(
        (p, i) => `<div class="card"><h3>${i + 1}. ${p.text}</h3>
        <div class="row">${p.facts.map((f) => `<span class="fact">${f}</span>`).join("")}</div></div>`
      ).join("")}`;
    case "verify": {
      const v = PURPOSES.filter((p) => p.citation.status === "verified").length;
      const pend = PURPOSES.length - v;
      return `<h2>引用核验</h2><p>无出处标「待核」，不得伪装已确认。当前 ${v} 已核验 / ${pend} 待核。</p>${PURPOSES.map(
        (p, i) => {
          const pending = p.citation.status === "pending";
          return `<div class="card ${pending ? "pending" : ""}">
            <div class="row" style="justify-content:space-between;margin:0">
              <h3 style="flex:1">${i + 1}. ${p.text}</h3>
              <span class="badge ${pending ? "warn" : "ok"}">${pending ? "待核" : "已核验"}</span>
            </div>
            <div class="row">
              <span class="meta">${p.citation.label}</span>
              <button class="btn tiny ${pending ? "warn" : "ok"}" type="button" data-cite="${p.id}">${
                pending ? "查看待核原因" : "核验引用"
              }</button>
            </div>
          </div>`;
        }
      ).join("")}`;
    }
    case "diff":
      return `<h2>对照修订</h2><p>左：客户稿；右：证目建议。律师决定接受或保留。</p>
        <div class="row"><button class="btn tiny" type="button" id="accept-all">全部接受建议</button></div>
        ${PURPOSES.map((p, i) => {
          const d = state.decisions[p.id];
          return `<div class="card">
            <div class="row" style="justify-content:space-between;margin:0">
              <h3>第 ${i + 1} 条</h3>
              <span class="badge ${p.citation.status === "pending" ? "warn" : "ok"}">${
                p.citation.status === "pending" ? "含待核" : "已核验"
              }</span>
            </div>
            <div class="diff">
              <div><label>客户稿</label>${p.draft}</div>
              <div class="sug"><label>证目建议</label>${p.suggestion}</div>
            </div>
            <div class="row">
              <button class="btn tiny" type="button" data-dec="accept" data-id="${p.id}">接受</button>
              <button class="btn tiny ghost" type="button" data-dec="reject" data-id="${p.id}">保留原稿</button>
              ${d ? `<span class="badge ok">已决定</span>` : ""}
            </div>
          </div>`;
        }).join("")}`;
    case "confirm":
      return `<h2>律师确认</h2><p>导出前必须勾选终审声明。</p>
        ${PURPOSES.map((p, i) => {
          const d = state.decisions[p.id] || "accept";
          return `<div class="card row" style="justify-content:space-between">
            <span>${i + 1}. ${d === "reject" ? "保留原稿" : "已接受建议"}</span>
            <span class="badge ${p.citation.status === "pending" ? "warn" : "ok"}">${
              p.citation.status === "pending" ? "待核" : "已核验"
            }</span>
          </div>`;
        }).join("")}
        <label class="confirm"><input type="checkbox" id="lawyer" ${state.lawyerOk ? "checked" : ""} />
        <span>我已核验引用与表述。AI 不承担法律责任。</span></label>`;
    case "export":
      return `<h2>导出</h2><p>导出证明目的段落，贴入所内 Word/表格——非整套上庭文书。</p>
        <div class="row">
          <button class="btn" type="button" id="btn-copy" ${state.lawyerOk ? "" : "disabled"}>复制到剪贴板</button>
        </div>
        <p class="meta" id="msg">${state.lawyerOk ? "" : "请先在「确认」步勾选终审声明。"}</p>
        <pre class="preview">${exportText()}</pre>`;
    default:
      return "";
  }
}

function render() {
  const chips = $("#chips");
  chips.innerHTML = STEPS.map(
    (s, i) =>
      `<button class="chip ${i === state.step ? "active" : ""} ${i < state.step ? "done" : ""}" type="button" data-step="${i}">${String(
        i + 1
      ).padStart(2, "0")} ${s.label}</button>`
  ).join("");
  $("#panel").innerHTML = body();
  $("#btn-prev").disabled = state.step === 0;
  $("#btn-next").textContent = state.step === STEPS.length - 1 ? "完成" : "下一步";
}

$("#btn-start").onclick = () => {
  $("#flow").hidden = false;
  $(".hero").hidden = true;
  go(0);
};

document.body.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-step]");
  if (chip) {
    go(+chip.dataset.step);
    return;
  }
  const cite = e.target.closest("[data-cite]");
  if (cite) {
    openCite(PURPOSES.find((p) => p.id === cite.dataset.cite));
    return;
  }
  const dec = e.target.closest("[data-dec]");
  if (dec) {
    state.decisions[dec.dataset.id] = dec.dataset.dec;
    render();
    return;
  }
  if (e.target.id === "accept-all") {
    PURPOSES.forEach((p) => {
      state.decisions[p.id] = "accept";
    });
    render();
  }
  if (e.target.id === "btn-copy") {
    navigator.clipboard?.writeText(exportText()).then(() => {
      $("#msg").textContent = "已复制。";
    });
  }
});

document.body.addEventListener("change", (e) => {
  if (e.target.id === "lawyer") {
    state.lawyerOk = e.target.checked;
    render();
  }
});

$("#btn-prev").onclick = () => go(state.step - 1);
$("#btn-next").onclick = () => {
  if (state.step === STEPS.length - 1) {
    alert(state.lawyerOk ? "演示完成：已可复制导出内容。" : "请先完成律师确认。");
    return;
  }
  if (STEPS[state.step].id === "diff") {
    PURPOSES.forEach((p) => {
      if (!state.decisions[p.id]) state.decisions[p.id] = "accept";
    });
  }
  go(state.step + 1);
};
