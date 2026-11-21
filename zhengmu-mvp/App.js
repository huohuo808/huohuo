import { useMemo, useState, useCallback } from "react";
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Alert,
  Platform,
  Share,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import { colors } from "./src/theme";
import {
  STEPS,
  SAMPLE_EVIDENCE,
  MOCK_PURPOSES,
  DEFAULT_CASE_NAME,
  DEFAULT_CASE_TYPE,
  DEFAULT_FACTS,
} from "./src/data";

const stepIndex = (id) => STEPS.findIndex((s) => s.id === id);

function Pill({ children, tone = "soft" }) {
  const map = {
    soft: { bg: "#ebe4d8", fg: colors.inkSoft },
    ok: { bg: colors.okBg, fg: colors.ok },
    warn: { bg: colors.warnBg, fg: colors.warn },
  };
  const t = map[tone] || map.soft;
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      <Text style={[styles.pillText, { color: t.fg }]}>{children}</Text>
    </View>
  );
}

function Btn({ title, onPress, variant = "primary", disabled, style, testID }) {
  const bg =
    variant === "primary"
      ? colors.accent
      : variant === "ghost"
        ? "transparent"
        : colors.spineSoft;
  const border = variant === "ghost" ? colors.line : "transparent";
  const color = variant === "primary" ? colors.white : colors.ink;
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={testID || title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <Text style={[styles.btnText, { color }]}>{title}</Text>
    </Pressable>
  );
}

export default function App() {
  const [screen, setScreen] = useState("splash");
  const [active, setActive] = useState("reach");
  const [farthest, setFarthest] = useState(0);
  const [generated, setGenerated] = useState(false);
  const [evidence, setEvidence] = useState(SAMPLE_EVIDENCE);
  const [purposes, setPurposes] = useState([]);
  const [decisions, setDecisions] = useState({});
  const [editedTexts, setEditedTexts] = useState({});
  const [lawyerOk, setLawyerOk] = useState(false);
  const [caseName, setCaseName] = useState(DEFAULT_CASE_NAME);
  const [facts, setFacts] = useState(DEFAULT_FACTS);
  const [citeModal, setCiteModal] = useState(null);
  const [exportMsg, setExportMsg] = useState("");

  const goTab = (tab) => setScreen(tab);

  const runGenerate = useCallback((thenId) => {
    setPurposes(MOCK_PURPOSES.map((p) => ({ ...p })));
    setDecisions({});
    setEditedTexts({});
    setGenerated(true);
    setLawyerOk(false);
    setFarthest((f) => Math.max(f, stepIndex("generate")));
    const next = thenId || "generate";
    setActive(next);
    setFarthest((f) => Math.max(f, stepIndex(next)));
    setScreen("flow");
  }, []);

  const openStep = useCallback(
    (id) => {
      const i = stepIndex(id);
      if (i < 0) return;
      if (i > farthest + 1) return;
      if (["verify", "diff", "confirm", "export"].includes(id) && !generated) {
        runGenerate(id);
        return;
      }
      setActive(id);
      setFarthest((f) => Math.max(f, i));
      setScreen("flow");
    },
    [farthest, generated, runGenerate]
  );

  const finalText = (p) => {
    const d = decisions[p.id];
    if (d === "reject") return p.draftClient;
    if (d === "edit") return editedTexts[p.id] || p.suggestion;
    return p.suggestion;
  };

  const exportText = useMemo(() => {
    if (!purposes.length) return "（尚未生成证明目的）";
    return [
      "证据目录 · 证明目的（证目 Expo App 导出）",
      `案件：${caseName}`,
      `案由：${DEFAULT_CASE_TYPE}`,
      "",
      ...purposes.map((p, i) => {
        const ev = p.evidenceIds
          .map((id) => evidence.find((e) => e.id === id)?.no)
          .filter(Boolean)
          .join("、");
        const flag = p.citation.status === "pending" ? "【待核】" : "【已核验】";
        return `${i + 1}. ${ev}\n证明目的：${finalText(p)}\n引用：${p.citation.label} ${flag}`;
      }),
      "",
      "——",
      "声明：本段落经主办律师确认后导出，仅供贴入所内证据目录模板；不构成可上庭整套文书。",
    ].join("\n");
  }, [purposes, caseName, evidence, decisions, editedTexts]);

  const summaryFor = (id) => {
    switch (id) {
      case "reach":
        return "人伤模板";
      case "evidence":
        return `${evidence.length} 组`;
      case "facts":
        return "3 项";
      case "generate":
        return generated ? `${purposes.length} 条` : "待生成";
      case "verify":
        if (!generated) return "待核验";
        return `${purposes.filter((p) => p.citation.status === "pending").length} 待核`;
      case "diff":
        return generated ? `${Object.keys(decisions).length}/${purposes.length}` : "待修订";
      case "confirm":
        return lawyerOk ? "已确认" : "待确认";
      case "export":
        return lawyerOk ? "可导出" : "锁定";
      default:
        return "";
    }
  };

  const renderStepBody = (id) => {
    switch (id) {
      case "reach":
        return (
          <View>
            <Text style={styles.lede}>选择案由模板新建案件。只做证明目的建议稿，不做一键可上庭文书。</Text>
            <Text style={styles.label}>案件名称</Text>
            <TextInput style={styles.input} value={caseName} onChangeText={setCaseName} multiline />
            <View style={styles.boundary}>
              <Text style={styles.boundaryTitle}>产品边界</Text>
              <Text style={styles.boundaryText}>AI 没有办法帮人担责。终审权在主办律师。</Text>
            </View>
            <Btn testID="next-evidence" title="载入样例 → 证据组" onPress={() => openStep("evidence")} style={{ marginTop: 12 }} />
          </View>
        );
      case "evidence":
        return (
          <View>
            <Text style={styles.lede}>交通事故人伤证据组样例。</Text>
            {evidence.map((e) => (
              <View key={e.id} style={styles.itemCard}>
                <Text style={styles.itemTitle}>
                  {e.no}　{e.name}
                </Text>
                <Text style={styles.itemBody}>{e.summary}</Text>
              </View>
            ))}
            <Btn
              title="+ 添加证据"
              variant="ghost"
              onPress={() => {
                const n = evidence.length + 1;
                setEvidence((prev) => [
                  ...prev,
                  { id: `e${Date.now()}`, no: `证据${n}`, name: "补充证据（演示）", summary: "请填写摘要。" },
                ]);
              }}
              style={{ marginTop: 8 }}
            />
            <Btn testID="next-facts" title="下一步：待证事实" onPress={() => openStep("facts")} style={{ marginTop: 8 }} />
          </View>
        );
      case "facts":
        return (
          <View>
            <Text style={styles.lede}>对齐争议焦点，便于绑定日期与金额。</Text>
            <TextInput style={[styles.input, { minHeight: 110 }]} value={facts} onChangeText={setFacts} multiline />
            <Btn testID="next-generate" title="下一步：生成证明目的" onPress={() => openStep("generate")} style={{ marginTop: 10 }} />
          </View>
        );
      case "generate":
        if (!generated) {
          return (
            <View>
              <Text style={styles.lede}>生成简洁、事实绑定的证明目的短句（Mock）。</Text>
              <Btn testID="btn-generate" title="生成证明目的" onPress={() => runGenerate("generate")} />
            </View>
          );
        }
        return (
          <View>
            <Text style={styles.lede}>已生成 {purposes.length} 条。进入引用核验。</Text>
            {purposes.map((p, i) => (
              <View key={p.id} style={styles.itemCard}>
                <Text style={styles.itemTitle}>
                  {i + 1}. {p.text}
                </Text>
                <View style={styles.chipRow}>
                  {p.facts.map((f) => (
                    <View key={f} style={styles.factChip}>
                      <Text style={styles.factChipText}>{f}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
            <Btn testID="next-verify" title="下一步：引用核验" onPress={() => openStep("verify")} style={{ marginTop: 8 }} />
          </View>
        );
      case "verify": {
        const verified = purposes.filter((p) => p.citation.status === "verified").length;
        const pending = purposes.filter((p) => p.citation.status === "pending").length;
        return (
          <View>
            <Text style={styles.lede}>无出处标「待核」，不得伪装已确认。</Text>
            <View style={styles.statusRow}>
              <Text style={styles.statusText}>
                <Text style={styles.strong}>{purposes.length}</Text> 条
              </Text>
              <Text style={[styles.statusText, { color: colors.ok }]}>
                <Text style={styles.strong}>{verified}</Text> 已核验
              </Text>
              <Text style={[styles.statusText, { color: colors.warn }]}>
                <Text style={styles.strong}>{pending}</Text> 待核
              </Text>
            </View>
            {purposes.map((p, i) => {
              const isPending = p.citation.status === "pending";
              return (
                <View key={p.id} style={[styles.itemCard, isPending && styles.pendingCard]}>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.itemTitle, { flex: 1 }]}>
                      {i + 1}. {p.text}
                    </Text>
                    <Pill tone={isPending ? "warn" : "ok"}>{isPending ? "待核" : "已核验"}</Pill>
                  </View>
                  <Btn
                    title={isPending ? "待核原因" : "核验引用"}
                    variant="ghost"
                    onPress={() => setCiteModal(p)}
                    style={{ marginTop: 8 }}
                  />
                </View>
              );
            })}
            <Btn testID="next-diff" title="下一步：对照修订" onPress={() => openStep("diff")} style={{ marginTop: 8 }} />
          </View>
        );
      }
      case "diff":
        return (
          <View>
            <Text style={styles.lede}>客户稿 vs 建议稿。接受 / 改写 / 保留。</Text>
            <View style={styles.row}>
              <Btn
                testID="btn-accept-all"
                title="全部接受"
                variant="soft"
                onPress={() => {
                  const next = {};
                  purposes.forEach((p) => {
                    next[p.id] = "accept";
                  });
                  setDecisions(next);
                }}
              />
              <Btn
                title="重置"
                variant="ghost"
                onPress={() => {
                  setDecisions({});
                  setEditedTexts({});
                }}
              />
            </View>
            {purposes.map((p, idx) => (
              <View key={p.id} style={styles.itemCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.itemTitle}>第 {idx + 1} 条</Text>
                  <Pill tone={p.citation.status === "pending" ? "warn" : "ok"}>
                    {p.citation.status === "pending" ? "含待核" : "已核验"}
                  </Pill>
                </View>
                <View style={styles.diffBox}>
                  <Text style={styles.diffLabel}>客户稿</Text>
                  <Text style={styles.itemBody}>{p.draftClient}</Text>
                </View>
                <View style={[styles.diffBox, styles.diffSuggest]}>
                  <Text style={styles.diffLabel}>证目建议</Text>
                  <Text style={styles.itemBody}>{editedTexts[p.id] || p.suggestion}</Text>
                </View>
                <View style={styles.row}>
                  <Btn title="接受" onPress={() => setDecisions((d) => ({ ...d, [p.id]: "accept" }))} />
                  <Btn
                    title="改写"
                    variant="ghost"
                    onPress={() => {
                      setDecisions((d) => ({ ...d, [p.id]: "edit" }));
                      setEditedTexts((t) => ({ ...t, [p.id]: t[p.id] || p.suggestion }));
                    }}
                  />
                  <Btn title="保留" variant="ghost" onPress={() => setDecisions((d) => ({ ...d, [p.id]: "reject" }))} />
                </View>
                {decisions[p.id] === "edit" && (
                  <TextInput
                    style={[styles.input, { marginTop: 8, minHeight: 70 }]}
                    multiline
                    value={editedTexts[p.id] || ""}
                    onChangeText={(v) => setEditedTexts((t) => ({ ...t, [p.id]: v }))}
                  />
                )}
              </View>
            ))}
            <Btn
              testID="next-confirm"
              title="下一步：律师确认"
              onPress={() => {
                const next = { ...decisions };
                purposes.forEach((p) => {
                  if (!next[p.id]) next[p.id] = "accept";
                });
                setDecisions(next);
                openStep("confirm");
              }}
              style={{ marginTop: 8 }}
            />
          </View>
        );
      case "confirm":
        return (
          <View>
            <Text style={styles.lede}>导出前必须由主办律师确认。</Text>
            {purposes.map((p, idx) => {
              const d = decisions[p.id] || "accept";
              const label = d === "accept" ? "已接受" : d === "reject" ? "保留原稿" : "已改写";
              return (
                <View key={p.id} style={[styles.itemCard, styles.rowBetween]}>
                  <Text style={styles.itemBody}>
                    {idx + 1}. {label}
                  </Text>
                  <Pill tone={p.citation.status === "pending" ? "warn" : "ok"}>
                    {p.citation.status === "pending" ? "待核" : "已核验"}
                  </Pill>
                </View>
              );
            })}
            <Pressable testID="lawyer-confirm" style={styles.confirmBox} onPress={() => setLawyerOk((v) => !v)}>
              <Text style={styles.confirmCheck}>{lawyerOk ? "☑" : "☐"}</Text>
              <Text style={[styles.itemBody, { flex: 1 }]}>
                我已核验引用与表述。AI 不承担法律责任。
              </Text>
            </Pressable>
            <Btn testID="next-export" title="下一步：导出" disabled={!lawyerOk} onPress={() => openStep("export")} />
          </View>
        );
      case "export":
        return (
          <View>
            <Text style={styles.lede}>导出证明目的段落，贴入所内模板——非整套上庭文书。</Text>
            <View style={styles.row}>
              <Btn
                title="导出/分享"
                disabled={!lawyerOk}
                onPress={async () => {
                  if (!lawyerOk) return;
                  try {
                    await Share.share({ message: exportText });
                    setExportMsg("已调起系统分享。");
                  } catch {
                    setExportMsg("分享取消或失败。");
                  }
                }}
              />
              <Btn
                title="复制"
                variant="ghost"
                disabled={!lawyerOk}
                onPress={async () => {
                  if (!lawyerOk) return;
                  await Clipboard.setStringAsync(exportText);
                  setExportMsg("已复制到剪贴板。");
                  if (Platform.OS === "web") Alert.alert("已复制");
                }}
              />
            </View>
            {!lawyerOk && <Text style={styles.hint}>请先勾选律师确认。</Text>}
            {!!exportMsg && <Text style={styles.hint}>{exportMsg}</Text>}
            <Text style={styles.exportPreview}>{exportText}</Text>
          </View>
        );
      default:
        return null;
    }
  };

  const Splash = (
    <View style={styles.splash}>
      <StatusBar style="light" />
      <View style={styles.appIcon}>
        <Text style={styles.appIconText}>证</Text>
      </View>
      <Text style={styles.splashTitle}>证目</Text>
      <Text style={styles.splashSub}>证明目的 · 线性工作流</Text>
      <Text style={styles.splashMeta}>Expo App · 人审终控 · 不做一键可上庭</Text>
      <Btn testID="btn-enter" title="打开 App" onPress={() => goTab("home")} style={{ marginTop: 28, minWidth: 220 }} />
    </View>
  );

  const Home = (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.nav}>
        <Text style={styles.navTitle}>证目</Text>
        <Pill>演示 · 人伤</Pill>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>诉讼律师专用 · Expo App</Text>
          <Text style={styles.heroTitle}>证明目的工作台</Text>
          <Text style={styles.lede}>简洁、可核对、可溯源。法条可核验，对照修订由律师终审。</Text>
          <Btn testID="btn-start-flow" title="开始线性流程" onPress={() => openStep("reach")} />
        </View>
        <View style={styles.grid}>
          {[
            { id: "reach", t: "建案", s: "案由模板", n: "01" },
            { id: "verify", t: "待核", s: "引用核验", n: "核" },
            { id: "diff", t: "修订", s: "对照稿", n: "订" },
            { id: "case", t: "案件", s: "样例信息", n: "案", tab: true },
          ].map((x) => (
            <Pressable
              key={x.id}
              style={styles.tile}
              onPress={() => (x.tab ? goTab("case") : openStep(x.id))}
            >
              <View style={styles.tileIco}>
                <Text style={styles.tileIcoText}>{x.n}</Text>
              </View>
              <Text style={styles.tileTitle}>{x.t}</Text>
              <Text style={styles.tileSub}>{x.s}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.boundary}>
          <Text style={styles.boundaryTitle}>产品边界</Text>
          <Text style={styles.boundaryText}>AI 没有办法帮人担责。只出可核验建议稿，不做一键可上庭文书。</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  const Flow = (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.nav}>
        <Text style={styles.navTitle}>线性流程</Text>
        <Btn title="收起" variant="ghost" onPress={() => setActive("")} style={{ paddingVertical: 6, paddingHorizontal: 10 }} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}>
        {STEPS.map((s, i) => {
          const cur = stepIndex(active);
          const isActive = active === s.id;
          const done = cur >= 0 && i < cur;
          return (
            <Pressable
              key={s.id}
              onPress={() => openStep(s.id)}
              style={[styles.chip, isActive && styles.chipActive, done && !isActive && styles.chipDone]}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {String(i + 1).padStart(2, "0")} {s.short}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <ScrollView contentContainerStyle={styles.scroll}>
        {STEPS.map((s, i) => {
          const isActive = active === s.id;
          const done = i < stepIndex(active);
          return (
            <View key={s.id} style={styles.flowNode}>
              <View style={styles.rail}>
                <View style={[styles.dot, (isActive || done) && styles.dotOn]} />
                {i < STEPS.length - 1 && <View style={styles.connector} />}
              </View>
              <View style={[styles.flowCard, isActive && styles.flowCardActive]}>
                <Pressable style={styles.flowHead} onPress={() => openStep(s.id)}>
                  <Text style={styles.stepIndex}>{String(i + 1).padStart(2, "0")}</Text>
                  <Text style={styles.flowTitle}>{s.label}</Text>
                  <Text style={styles.flowSummary}>{summaryFor(s.id)}</Text>
                </Pressable>
                {isActive && <View style={styles.flowBody}>{renderStepBody(s.id)}</View>}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );

  const Case = (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.nav}>
        <Text style={styles.navTitle}>案件</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{caseName}</Text>
          <Text style={styles.lede}>{DEFAULT_CASE_TYPE}</Text>
          <Text style={styles.itemBody}>证据组：{evidence.length}</Text>
          <Text style={styles.itemBody}>
            流程：{active ? STEPS[stepIndex(active)]?.label : "已收起"}
            {generated ? " · 已生成" : ""}
          </Text>
          <Btn title="回到流程" onPress={() => goTab("flow")} style={{ marginTop: 14 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  return (
    <View style={styles.root}>
      {screen === "splash" && Splash}
      {screen === "home" && Home}
      {screen === "flow" && Flow}
      {screen === "case" && Case}

      {screen !== "splash" && (
        <View style={styles.tabbar}>
          {[
            { id: "home", label: "首页" },
            { id: "flow", label: "流程" },
            { id: "case", label: "案件" },
          ].map((t) => (
            <Pressable key={t.id} style={[styles.tab, screen === t.id && styles.tabActive]} onPress={() => goTab(t.id)}>
              <Text style={[styles.tabText, screen === t.id && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {citeModal && (
        <View style={styles.modalWrap}>
          <View style={styles.modal}>
            <View style={styles.rowBetween}>
              <Text style={styles.heroTitle}>
                {citeModal.citation.status === "pending" ? "引用待核" : "引用核验"}
              </Text>
              <Btn title="关闭" variant="ghost" onPress={() => setCiteModal(null)} />
            </View>
            <Text style={styles.label}>引用表述</Text>
            <Text style={styles.itemBody}>{citeModal.citation.label}</Text>
            <Text style={styles.label}>状态</Text>
            <Pill tone={citeModal.citation.status === "pending" ? "warn" : "ok"}>
              {citeModal.citation.status === "pending" ? "待核 — 不得伪装为已确认" : "已核验"}
            </Pill>
            <Text style={styles.label}>来源</Text>
            <Text style={styles.itemBody}>{citeModal.citation.source || "— 无可靠出处 —"}</Text>
            <Text style={styles.label}>说明</Text>
            <Text style={styles.itemBody}>{citeModal.citation.note}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  safe: { flex: 1, backgroundColor: colors.paper, paddingBottom: 64 },
  splash: {
    flex: 1,
    backgroundColor: colors.splashTop,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  appIcon: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  appIconText: { fontSize: 42, color: colors.accent, fontWeight: "700" },
  splashTitle: { fontSize: 40, color: colors.white, fontWeight: "700", letterSpacing: 8 },
  splashSub: { marginTop: 10, color: "rgba(255,255,255,0.85)", fontSize: 15 },
  splashMeta: { marginTop: 8, color: "rgba(255,255,255,0.65)", fontSize: 12 },
  nav: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navTitle: { fontSize: 22, fontWeight: "700", color: colors.ink },
  scroll: { padding: 14, paddingBottom: 40, gap: 10 },
  hero: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  eyebrow: { color: colors.accent, fontWeight: "600", fontSize: 12, marginBottom: 6 },
  heroTitle: { fontSize: 20, fontWeight: "700", color: colors.ink, marginBottom: 8 },
  lede: { color: colors.inkSoft, lineHeight: 22, fontSize: 14, marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "48%",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 12,
  },
  tileIco: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.spineSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  tileIcoText: { color: colors.accent, fontWeight: "700", fontSize: 11 },
  tileTitle: { fontWeight: "700", color: colors.ink },
  tileSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  boundary: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
  },
  boundaryTitle: { color: colors.white, fontWeight: "700", marginBottom: 6 },
  boundaryText: { color: "rgba(255,255,255,0.9)", lineHeight: 20, fontSize: 13 },
  chipBar: { maxHeight: 44, marginBottom: 4 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipDone: { backgroundColor: colors.spineSoft, borderColor: "#b9cfc7" },
  chipText: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  chipTextActive: { color: colors.white },
  flowNode: { flexDirection: "row", gap: 8 },
  rail: { width: 16, alignItems: "center" },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.card,
    marginTop: 16,
  },
  dotOn: { backgroundColor: colors.accent },
  connector: { flex: 1, width: 2, backgroundColor: colors.spineSoft, marginTop: 4, minHeight: 20 },
  flowCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    marginBottom: 10,
    overflow: "hidden",
  },
  flowCardActive: { borderColor: "#9fc4b8" },
  flowHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  stepIndex: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.accent,
    backgroundColor: colors.spineSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    overflow: "hidden",
  },
  flowTitle: { flex: 1, fontWeight: "700", color: colors.ink, fontSize: 15 },
  flowSummary: { color: colors.muted, fontSize: 11, maxWidth: 72 },
  flowBody: { borderTopWidth: 1, borderTopColor: colors.line, padding: 12 },
  label: { color: colors.muted, fontSize: 12, marginTop: 8, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.white,
    color: colors.ink,
    fontSize: 14,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 10,
    backgroundColor: colors.white,
    marginBottom: 8,
  },
  pendingCard: { borderColor: "#e0c28a", backgroundColor: "#fffdf8" },
  itemTitle: { fontWeight: "600", color: colors.ink, fontSize: 13, lineHeight: 20 },
  itemBody: { color: colors.inkSoft, fontSize: 13, lineHeight: 20, marginTop: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  factChip: {
    backgroundColor: colors.spineSoft,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  factChipText: { color: colors.accent, fontSize: 11, fontWeight: "600" },
  statusRow: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#faf7f1",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  statusText: { color: colors.muted, fontSize: 13 },
  strong: { fontWeight: "700", color: colors.ink },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 6 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  diffBox: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 8,
    backgroundColor: "#faf8f4",
    marginTop: 8,
  },
  diffSuggest: { backgroundColor: "#f3f8f6", borderColor: "#b9cfc7" },
  diffLabel: { fontSize: 11, fontWeight: "700", color: colors.muted, marginBottom: 4 },
  confirmBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: colors.warnBg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    marginVertical: 10,
  },
  confirmCheck: { fontSize: 18, color: colors.accent },
  hint: { color: colors.muted, fontSize: 12, marginTop: 6 },
  exportPreview: {
    marginTop: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#faf8f4",
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 18,
  },
  btn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  btnText: { fontWeight: "700", fontSize: 14 },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 11, fontWeight: "700" },
  tabbar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    backgroundColor: "rgba(255,252,248,0.96)",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingBottom: Platform.OS === "ios" ? 18 : 10,
    paddingTop: 8,
    paddingHorizontal: 10,
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 12 },
  tabActive: { backgroundColor: colors.spineSoft },
  tabText: { color: colors.muted, fontWeight: "600", fontSize: 13 },
  tabTextActive: { color: colors.accent },
  modalWrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(26,35,50,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modal: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 4,
  },
});
