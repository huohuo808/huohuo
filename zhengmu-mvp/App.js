import { useMemo, useState, useCallback, useRef, useEffect } from "react";
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
  Image,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { colors } from "./src/theme";
import {
  STEPS,
  SAMPLE_EVIDENCE,
  MOCK_PURPOSES,
  DEFAULT_CASE_NAME,
  DEFAULT_CASE_TYPE,
  DEFAULT_FACTS,
  FACT_OPTIONS,
} from "./src/data";
import { buildScannedEvidence } from "./src/scanEvidence";
import {
  purposesForSelection,
  hasPendingCitation,
  canExportFinal,
  sessionFingerprint,
  buildExportText,
  finalPurposeText,
} from "./src/gates";

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
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState(() => SAMPLE_EVIDENCE.map((e) => e.id));
  const [selectedFactIds, setSelectedFactIds] = useState(() => FACT_OPTIONS.map((f) => f.id));
  const [purposes, setPurposes] = useState([]);
  const [decisions, setDecisions] = useState({});
  const [editedTexts, setEditedTexts] = useState({});
  const [lawyerOk, setLawyerOk] = useState(false);
  const [confirmedFingerprint, setConfirmedFingerprint] = useState("");
  const [confirmedExportText, setConfirmedExportText] = useState("");
  const [caseName, setCaseName] = useState(DEFAULT_CASE_NAME);
  const [facts, setFacts] = useState(DEFAULT_FACTS);
  const [citeModal, setCiteModal] = useState(null);
  const [exportMsg, setExportMsg] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const scanCountRef = useRef(0);

  const goTab = (tab) => setScreen(tab);

  const factsTextFromSelection = useCallback((ids) => {
    const set = new Set(ids);
    return FACT_OPTIONS.filter((f) => set.has(f.id))
      .map((f, i) => `${i + 1}. ${f.label}`)
      .join("\n");
  }, []);

  const appendScanned = useCallback((uri) => {
    const item = buildScannedEvidence(evidence.length, uri, scanCountRef.current);
    scanCountRef.current += 1;
    setEvidence((prev) => [...prev, item]);
    setSelectedEvidenceIds((prev) => [...prev, item.id]);
  }, [evidence.length]);

  const invalidateConfirm = useCallback((msg) => {
    setLawyerOk(false);
    setConfirmedFingerprint("");
    setConfirmedExportText("");
    if (msg) setExportMsg(msg);
  }, []);

  const scanWithCamera = useCallback(async () => {
    if (scanBusy) return;
    setScanBusy(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("需要摄像头权限", "请在系统设置中允许证目使用摄像头，以便扫描纸质证据。");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      appendScanned(result.assets[0].uri);
    } catch (err) {
      Alert.alert("扫描失败", Platform.OS === "web" ? "当前浏览器可能不支持摄像头；请用手机 Expo Go 打开本 App。" : String(err?.message || err));
    } finally {
      setScanBusy(false);
    }
  }, [appendScanned, scanBusy]);

  const pickFromLibrary = useCallback(async () => {
    if (scanBusy) return;
    setScanBusy(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("需要相册权限", "请允许访问相册以导入证据照片。");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      appendScanned(result.assets[0].uri);
    } catch (err) {
      Alert.alert("导入失败", String(err?.message || err));
    } finally {
      setScanBusy(false);
    }
  }, [appendScanned, scanBusy]);

  const runGenerate = useCallback(
    (thenId) => {
      const matched = purposesForSelection(MOCK_PURPOSES, selectedEvidenceIds).map((p) => ({ ...p }));
      const picked = matched.length ? matched : [];
      setPurposes(picked);
      setDecisions({});
      setEditedTexts({});
      setGenerated(true);
      invalidateConfirm(picked.length ? "" : "当前所选证据无法匹配样例证明目的，请勾选预置证据组。");
      setFarthest((f) => Math.max(f, stepIndex("generate")));
      const next = thenId || "generate";
      setActive(next);
      setFarthest((f) => Math.max(f, stepIndex(next)));
      setScreen("flow");
    },
    [selectedEvidenceIds, invalidateConfirm]
  );

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

  const fingerprint = useMemo(
    () =>
      sessionFingerprint({
        evidence,
        selectedEvidenceIds,
        facts,
        selectedFacts: selectedFactIds,
        decisions,
        editedTexts,
        purposes,
      }),
    [evidence, selectedEvidenceIds, facts, selectedFactIds, decisions, editedTexts, purposes]
  );

  const pending = useMemo(() => hasPendingCitation(purposes), [purposes]);

  const liveExportText = useMemo(
    () =>
      buildExportText({
        purposes,
        caseName,
        caseType: DEFAULT_CASE_TYPE,
        evidence,
        decisions,
        editedTexts,
        mode: pending ? "draft" : "final",
      }),
    [purposes, caseName, evidence, decisions, editedTexts, pending]
  );

  const exportGate = useMemo(
    () =>
      canExportFinal({
        lawyerOk,
        hasPending: pending,
        fingerprint,
        confirmedFingerprint,
      }),
    [lawyerOk, pending, fingerprint, confirmedFingerprint]
  );

  const exportText = exportGate.ok && confirmedExportText ? confirmedExportText : liveExportText;

  useEffect(() => {
    if (!lawyerOk) return;
    if (confirmedFingerprint && fingerprint !== confirmedFingerprint) {
      invalidateConfirm("证据、金额或修订内容已变，旧确认已失效，请重新确认。");
    }
  }, [fingerprint, lawyerOk, confirmedFingerprint, invalidateConfirm]);

  const summaryFor = (id) => {
    switch (id) {
      case "reach":
        return "人伤模板";
      case "evidence":
        return `已选 ${selectedEvidenceIds.length}/${evidence.length}`;
      case "facts":
        return `已选 ${selectedFactIds.length}`;
      case "generate":
        return generated ? `${purposes.length} 条` : "待生成";
      case "verify":
        if (!generated) return "待核验";
        return `${purposes.filter((p) => p.citation.status === "pending").length} 待核`;
      case "diff":
        return generated ? `${Object.keys(decisions).length}/${purposes.length}` : "待修订";
      case "confirm":
        return lawyerOk && exportGate.ok ? "已确认" : pending ? "有待核" : "待确认";
      case "export":
        return exportGate.ok ? "可定稿" : "锁定";
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
            <Text style={styles.lede}>勾选参与生成的证据组。可保留预置样例，或用摄像头/相册追加（扫描结果为模拟 OCR）。</Text>
            <View style={styles.mockBanner}>
              <Text style={styles.mockBannerText}>摄像头 / 相册导入仅演示：摘要带【模拟 OCR】标记，非真实识别。</Text>
            </View>
            <View style={styles.scanRow}>
              <Btn
                testID="scan-camera"
                title={scanBusy ? "处理中…" : "摄像头扫描"}
                onPress={scanWithCamera}
                disabled={scanBusy}
                style={{ flex: 1 }}
              />
              <Btn
                testID="scan-album"
                title="相册导入"
                variant="ghost"
                onPress={pickFromLibrary}
                disabled={scanBusy}
                style={{ flex: 1 }}
              />
            </View>
            <View style={styles.row}>
              <Btn
                title="全选样例"
                variant="ghost"
                onPress={() => setSelectedEvidenceIds(evidence.filter((e) => e.source === "preset").map((e) => e.id))}
              />
              <Btn
                title="仅医疗费(e2+e3)"
                variant="ghost"
                testID="select-medical"
                onPress={() => setSelectedEvidenceIds(["e2", "e3"])}
              />
            </View>
            {evidence.map((e) => {
              const on = selectedEvidenceIds.includes(e.id);
              return (
                <Pressable
                  key={e.id}
                  testID={`ev-${e.id}`}
                  style={[styles.itemCard, on && styles.itemCardSelected]}
                  onPress={() => {
                    setSelectedEvidenceIds((prev) =>
                      prev.includes(e.id) ? prev.filter((id) => id !== e.id) : [...prev, e.id]
                    );
                  }}
                >
                  <View style={styles.rowBetween}>
                    <Text style={[styles.itemTitle, { flex: 1 }]}>
                      {on ? "☑" : "☐"} {e.no}　{e.name}
                    </Text>
                    {e.source === "camera" || e.ocrMock ? <Pill tone="warn">模拟 OCR</Pill> : <Pill tone="soft">预置</Pill>}
                  </View>
                  {e.uri ? (
                    <Image source={{ uri: e.uri }} style={styles.scanThumb} accessibilityLabel={`${e.no}扫描预览`} />
                  ) : null}
                  <Text style={styles.itemBody}>{e.summary}</Text>
                  {e.id === "e3" || (e.amount != null && e.source === "preset") ? (
                    <View
                      style={{ marginTop: 8 }}
                      onStartShouldSetResponder={() => true}
                      onPress={(ev) => ev?.stopPropagation?.()}
                    >
                      <Text style={styles.label}>金额（修改会作废已确认）</Text>
                      <TextInput
                        testID={`amount-${e.id}`}
                        accessibilityLabel={`amount-${e.id}`}
                        style={styles.input}
                        keyboardType="decimal-pad"
                        value={e.amount == null ? "" : String(e.amount)}
                        onChangeText={(v) => {
                          const num = v.trim() === "" ? null : Number(v);
                          setEvidence((prev) =>
                            prev.map((row) =>
                              row.id === e.id
                                ? {
                                    ...row,
                                    amount: Number.isFinite(num) ? num : row.amount,
                                    summary: Number.isFinite(num)
                                      ? `住院医疗费合计人民币 ${num.toFixed(2)} 元。`
                                      : row.summary,
                                    originalSnippet: Number.isFinite(num)
                                      ? `${row.sourceNote || ""}｜金额：¥${num.toFixed(2)}`
                                      : row.originalSnippet,
                                  }
                                : row
                            )
                          );
                        }}
                      />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
            <Btn
              title="更换：移除证据5（后续门诊）"
              variant="ghost"
              testID="swap-drop-e5"
              onPress={() => {
                setEvidence((prev) => prev.filter((e) => e.id !== "e5"));
                setSelectedEvidenceIds((prev) => prev.filter((id) => id !== "e5"));
              }}
              style={{ marginTop: 8 }}
            />
            <Btn
              title="恢复预置样例"
              variant="ghost"
              onPress={() => {
                setEvidence(SAMPLE_EVIDENCE);
                setSelectedEvidenceIds(SAMPLE_EVIDENCE.map((e) => e.id));
                scanCountRef.current = 0;
              }}
            />
            <Btn
              testID="next-facts"
              title="下一步：待证事实"
              disabled={!selectedEvidenceIds.length}
              onPress={() => openStep("facts")}
              style={{ marginTop: 8 }}
            />
          </View>
        );
      case "facts":
        return (
          <View>
            <Text style={styles.lede}>勾选要对齐的待证事实（可改文案）。</Text>
            {FACT_OPTIONS.map((f) => {
              const on = selectedFactIds.includes(f.id);
              return (
                <Pressable
                  key={f.id}
                  testID={`fact-${f.id}`}
                  style={[styles.itemCard, on && styles.itemCardSelected]}
                  onPress={() => {
                    setSelectedFactIds((prev) => {
                      const next = prev.includes(f.id) ? prev.filter((id) => id !== f.id) : [...prev, f.id];
                      setFacts(factsTextFromSelection(next));
                      return next;
                    });
                  }}
                >
                  <Text style={styles.itemBody}>
                    {on ? "☑" : "☐"} {f.label}
                  </Text>
                </Pressable>
              );
            })}
            <Text style={styles.label}>事实摘要（可编辑）</Text>
            <TextInput
              style={[styles.input, { minHeight: 90 }]}
              value={facts}
              onChangeText={setFacts}
              multiline
            />
            <Btn
              testID="next-generate"
              title="下一步：生成证明目的"
              disabled={!selectedFactIds.length}
              onPress={() => openStep("generate")}
              style={{ marginTop: 10 }}
            />
          </View>
        );
      case "generate":
        if (!generated) {
          return (
            <View>
              <Text style={styles.lede}>
                按已选证据匹配样例短句。路演可先点「仅医疗费」再生成 → 通常得到 1 条。
              </Text>
              <Text style={styles.hint}>已选证据 {selectedEvidenceIds.length} · 待证事实 {selectedFactIds.length}</Text>
              <Btn testID="btn-generate" title="生成证明目的" onPress={() => runGenerate("generate")} />
            </View>
          );
        }
        return (
          <View>
            <Text style={styles.lede}>已生成 {purposes.length} 条（Mock，绑定已选证据）。</Text>
            {!purposes.length && <Text style={styles.hint}>无匹配条目：请勾选 e2+e3 等预置证据后重新生成。</Text>}
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
            <Btn testID="btn-regenerate" title="按当前选择重新生成" variant="ghost" onPress={() => runGenerate("generate")} />
            <Btn
              testID="next-verify"
              title="下一步：引用核验"
              disabled={!purposes.length}
              onPress={() => openStep("verify")}
              style={{ marginTop: 8 }}
            />
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
                    testID={`cite-${p.id}`}
                    title={isPending ? "待核 · 核对原文" : "引用核对原文"}
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
                <Text style={styles.hint}>定稿文案：{finalPurposeText(p, decisions, editedTexts)}</Text>
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
            <Text style={styles.lede}>定稿导出前须律师确认；含「待核」不可定稿。修改金额/证据/修订后确认自动失效。</Text>
            {pending && (
              <View style={styles.mockBanner}>
                <Text style={styles.mockBannerText}>当前含待核引用，不能勾选定稿确认。请回到核验处理或去掉对应证明目的。</Text>
              </View>
            )}
            {purposes.map((p, idx) => {
              const d = decisions[p.id] || "accept";
              const label = d === "accept" ? "已接受" : d === "reject" ? "保留原稿" : "已改写";
              return (
                <View key={p.id} style={styles.itemCard}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.itemBody}>
                      {idx + 1}. {label}
                    </Text>
                    <Pill tone={p.citation.status === "pending" ? "warn" : "ok"}>
                      {p.citation.status === "pending" ? "待核" : "已核验"}
                    </Pill>
                  </View>
                  <Text style={styles.itemBody}>{finalPurposeText(p, decisions, editedTexts)}</Text>
                </View>
              );
            })}
            <Pressable
              testID="lawyer-confirm"
              accessibilityLabel="lawyer-confirm"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!(lawyerOk && exportGate.ok) }}
              style={[styles.confirmBox, pending && { opacity: 0.5 }]}
              onPress={() => {
                if (pending) {
                  const msg = "存在待核引用时不可律师确认定稿。";
                  if (Platform.OS === "web" && typeof window !== "undefined" && window.alert) {
                    window.alert(`不能定稿\n${msg}`);
                  } else {
                    Alert.alert("不能定稿", msg);
                  }
                  return;
                }
                if (lawyerOk) {
                  invalidateConfirm("");
                  return;
                }
                const snap = buildExportText({
                  purposes,
                  caseName,
                  caseType: DEFAULT_CASE_TYPE,
                  evidence,
                  decisions,
                  editedTexts,
                  mode: "final",
                });
                setConfirmedExportText(snap);
                setConfirmedFingerprint(fingerprint);
                setLawyerOk(true);
                setExportMsg("已锁定当前定稿版本。");
              }}
            >
              <Text style={styles.confirmCheck}>{lawyerOk && exportGate.ok ? "☑" : "☐"}</Text>
              <Text style={[styles.itemBody, { flex: 1 }]}>
                我已核验引用与表述，确认导出该版本。AI 不承担法律责任。
              </Text>
            </Pressable>
            <Btn
              testID="next-export"
              title="下一步：导出定稿"
              disabled={!exportGate.ok}
              onPress={() => openStep("export")}
            />
          </View>
        );
      case "export":
        return (
          <View>
            <Text style={styles.lede}>定稿导出内容 = 律师确认时锁定的版本。未确认或含待核时不可导出定稿。</Text>
            {!exportGate.ok && <Text style={styles.hint}>锁定原因：{exportGate.reason}</Text>}
            <View style={styles.row}>
              <Btn
                testID="btn-export-final"
                title="导出定稿/分享"
                disabled={!exportGate.ok}
                onPress={async () => {
                  if (!exportGate.ok) return;
                  try {
                    await Share.share({ message: exportText });
                    setExportMsg("已调起系统分享（定稿）。");
                  } catch {
                    setExportMsg("分享取消或失败。");
                  }
                }}
              />
              <Btn
                testID="btn-copy-final"
                title="复制定稿"
                variant="ghost"
                disabled={!exportGate.ok}
                onPress={async () => {
                  if (!exportGate.ok) return;
                  await Clipboard.setStringAsync(exportText);
                  setExportMsg("已复制定稿到剪贴板。");
                  if (Platform.OS === "web") Alert.alert("已复制定稿");
                }}
              />
            </View>
            {!!exportMsg && <Text style={styles.hint}>{exportMsg}</Text>}
            <Text style={styles.label}>预览</Text>
            <Text style={styles.exportPreview} testID="export-preview">
              {exportGate.ok ? exportText : liveExportText}
            </Text>
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
                {citeModal.citation.status === "pending" ? "待核 · 核对原文" : "引用核对原文"}
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
            {!!citeModal.citation.path && (
              <>
                <Text style={styles.label}>核验路径</Text>
                <Text style={styles.itemBody}>{citeModal.citation.path}</Text>
              </>
            )}
            <Text style={styles.label}>说明</Text>
            <Text style={styles.itemBody}>{citeModal.citation.note}</Text>
            <Text style={styles.label}>关联证据原文摘要</Text>
            {(citeModal.evidenceIds || []).map((id) => {
              const e = evidence.find((row) => row.id === id);
              if (!e) return null;
              return (
                <View key={id} style={[styles.diffBox, { marginTop: 6 }]}>
                  <Text style={styles.diffLabel}>
                    {e.no}　{e.name}
                    {e.ocrMock ? " · 模拟 OCR" : ""}
                  </Text>
                  <Text style={styles.itemBody}>{e.originalSnippet || e.summary}</Text>
                </View>
              );
            })}
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
  mockBanner: {
    backgroundColor: colors.warnBg,
    borderColor: "#e0c28a",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  mockBannerText: { color: colors.warn, fontSize: 13, lineHeight: 18 },
  itemCardSelected: { borderColor: colors.accent, backgroundColor: "#f3f8f6" },
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
  scanRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  scanThumb: {
    width: "100%",
    height: 140,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 6,
    backgroundColor: "#ebe4d8",
  },
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
