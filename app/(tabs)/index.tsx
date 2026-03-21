import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { AlertsContext, ThemeContext, WatchlistContext, type AlertItem } from "../_layout";

type MarketPhase = "Closed" | "Pre-market" | "Open" | "After-hours"; // 市场阶段类型，用于表示当前美股所处的交易状态

function pad2(n: number) { // 将数字补齐为两位字符串，用于时间显示格式化
  return n < 10 ? `0${n}` : `${n}`;
}

function fmtHms(ms: number) { // 将毫秒时间差转换为倒计时字符串，用于显示距离市场状态切换的剩余时间
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (hh > 0) return `${hh}:${pad2(mm)}:${pad2(ss)}`;
  return `${mm}:${pad2(ss)}`;
}

function getUsMarketStatus(now: Date) { // 根据当前时间计算美股市场状态，返回当前阶段，显示文本，以及下一次状态切换时间
  const day = now.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) {
    const daysToMon = day === 0 ? 1 : 2;
    const next = new Date(now);
    next.setDate(now.getDate() + daysToMon);
    next.setHours(1, 0, 0, 0);
    return { phase: "Closed" as MarketPhase, label: "Closed (Weekend)", nextChangeAt: next };
  }

  const mins = now.getHours() * 60 + now.getMinutes();
  const preStart = 1 * 60 + 0;
  const regStart = 6 * 60 + 30;
  const regEnd = 13 * 60 + 0;
  const afterEnd = 17 * 60 + 0;

  const at = (h: number, m: number) => {
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    return d;
  };

  if (mins >= preStart && mins < regStart) return { phase: "Pre-market" as MarketPhase, label: "Pre-market", nextChangeAt: at(6, 30) };
  if (mins >= regStart && mins < regEnd) return { phase: "Open" as MarketPhase, label: "Open", nextChangeAt: at(13, 0) };
  if (mins >= regEnd && mins < afterEnd) return { phase: "After-hours" as MarketPhase, label: "After-hours", nextChangeAt: at(17, 0) };

  const next = mins < preStart ? at(1, 0) : (() => {
    const d = new Date(now);
    d.setDate(now.getDate() + 1);
    d.setHours(1, 0, 0, 0);
    return d;
  })();

  return { phase: "Closed" as MarketPhase, label: "Closed", nextChangeAt: next };
}

// 根据市场阶段返回对应的标签样式，用于界面上显示当前市场状态
function badgeForPhase(phase: MarketPhase) { 
  if (phase === "Open") return { bg: "rgba(52, 199, 89, 0.18)", text: "Open" };
  if (phase === "Pre-market") return { bg: "rgba(10, 132, 255, 0.18)", text: "Pre-market" };
  if (phase === "After-hours") return { bg: "rgba(255, 149, 0, 0.18)", text: "After-hours" };
  return { bg: "rgba(255, 255, 255, 0.10)", text: "Closed" };
}

// 将提醒规则转换为可读文本
function fmtRule(rule: AlertItem["rule"]) {
  return rule === "ABOVE" ? "Above" : "Below";
}

// 首页组件
export default function HomeScreen() {
  const router = useRouter(); // 获取路由控制、主题、自选股列表、提醒数据
  const { colors, resolvedScheme } = useContext(ThemeContext);
  const { watchlist } = useContext(WatchlistContext);
  const { alerts } = useContext(AlertsContext);

  // 页面状态
  const [now, setNow] = useState(new Date());
  const [quickSymbol, setQuickSymbol] = useState("");

  // 每秒更新一次当前时间，用于驱动倒计时和市场状态实时变化
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = useMemo(() => now.toLocaleString(), [now]); // 当前时间字符串，用于页面展示

  const market = useMemo(() => getUsMarketStatus(now), [now]); // 计算当前市场状态，标签样式，以及距离下次状态变化的倒计时
  const badge = useMemo(() => badgeForPhase(market.phase), [market.phase]);
  const countdown = useMemo(() => fmtHms(market.nextChangeAt.getTime() - now.getTime()), [market.nextChangeAt, now]);

  const activeAlerts = useMemo(() => alerts.filter((a) => a.enabled).length, [alerts]);
  const recentAlerts = useMemo(() => alerts.slice(0, 2), [alerts]);
  const topWatch = useMemo(() => watchlist.slice(0, 6), [watchlist]);

  // 创建提醒入口
  const onCreateAlert = (sym?: string) => {
    const s = (sym ?? quickSymbol).trim().toUpperCase();
    if (!s) return;
    setQuickSymbol("");
    router.push({ pathname: "/alert/create", params: { symbol: s } });
  };

  // 页面整体结构
  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}> 
          <View>
            <Text style={[styles.appName, { color: colors.text }]}>StockClock</Text>
            <Text style={[styles.time, { color: colors.subtext }]}>{timeStr}</Text>
          </View>

          <Pressable
            style={[styles.pill, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push("/(tabs)/settings")}
          >
            <Text style={[styles.pillText, { color: colors.subtext }]}>
              Theme: {resolvedScheme === "dark" ? "Dark" : "Light"}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <View style={styles.cardRow}>
            <Text style={[styles.cardTitle, { color: colors.subtext }]}>Market</Text>
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.badgeText, { color: colors.text }]}>{badge.text}</Text>
            </View>
          </View>

          <Text style={[styles.marketMain, { color: colors.text }]}>{market.label}</Text>

          <View style={styles.cardRow}>
            <Text style={[styles.meta, { color: colors.subtext }]}>
              Next change in <Text style={{ color: colors.text, fontWeight: "700" }}>{countdown}</Text>
            </Text>
            <Text style={[styles.meta, { color: colors.subtext }]}>
              {market.nextChangeAt.toLocaleTimeString()}
            </Text>
          </View>

          <View style={styles.quickActionsRow}>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push("/(tabs)/explore")}
            >
              <Text style={[styles.actionBtnText, { color: colors.text }]}>Stocks</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push("/(tabs)/alerts")}
            >
              <Text style={[styles.actionBtnText, { color: colors.text }]}>Alerts</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtnPrimary, { backgroundColor: colors.tint }]}
              onPress={() => onCreateAlert()}
            >
              <Text style={[styles.actionBtnPrimaryText, { color: "#fff" }]}>New Alert</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.subtext }]}>Quick alert</Text>

          <View style={styles.quickCreateRow}>
            <TextInput // 股票代码输入框
              value={quickSymbol}
              onChangeText={setQuickSymbol}
              placeholder="Symbol (e.g. AAPL)"
              placeholderTextColor={resolvedScheme === "dark" ? "rgba(255,255,255,0.35)" : "rgba(17,24,39,0.35)"}
              autoCapitalize="characters"
              autoCorrect={false}
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: resolvedScheme === "dark" ? "rgba(255,255,255,0.06)" : "#f3f4f6",
                },
              ]}
            />
            <Pressable style={[styles.goBtn, { backgroundColor: colors.tint }]} onPress={() => onCreateAlert()}>
              <Text style={styles.goBtnText}>Go</Text>
            </Pressable>
          </View>

          <Text style={[styles.hint, { color: colors.subtext }]}>
            This opens the create page with the symbol prefilled.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardRow}>
            <Text style={[styles.cardTitle, { color: colors.subtext }]}>Watchlist</Text>
            <Text style={[styles.meta, { color: colors.subtext }]}>{watchlist.length} symbols</Text>
          </View>

          {topWatch.length === 0 ? (
            <Text style={[styles.emptyLine, { color: colors.subtext }]}>
              No watchlist symbols yet. Add from Stocks.
            </Text>
          ) : (
            <View style={styles.chipsWrap}>
              {topWatch.map((sym) => (
                <Pressable
                  key={sym}
                  style={[styles.chip, { borderColor: colors.border, backgroundColor: resolvedScheme === "dark" ? "rgba(255,255,255,0.06)" : "#f3f4f6" }]}
                  onPress={() => router.push(`/stock/${sym}`)}
                >
                  <Text style={[styles.chipText, { color: colors.text }]}>{sym}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.subActionsRow}>
            <Pressable // 单个股票标签
              style={[styles.linkBtn, { borderColor: colors.border }]}
              onPress={() => router.push("/(tabs)/explore")}
            >
              <Text style={[styles.linkBtnText, { color: colors.text }]}>Manage watchlist</Text>
            </Pressable>
          </View>
        </View>
        
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <View style={styles.cardRow}>
            <Text style={[styles.cardTitle, { color: colors.subtext }]}>Alerts</Text>
            <Text style={[styles.meta, { color: colors.subtext }]}>{activeAlerts} active</Text>
          </View>

          {alerts.length === 0 ? (
            <Text style={[styles.emptyLine, { color: colors.subtext }]}>
              No alerts yet. Create one from Alerts or Quick alert above.
            </Text>
          ) : (
            <View style={{ marginTop: 10, gap: 10 }}>
              {recentAlerts.map((a) => (
                <Pressable
                  key={a.id}
                  style={[styles.miniRow, { borderColor: colors.border, backgroundColor: resolvedScheme === "dark" ? "rgba(255,255,255,0.06)" : "#f3f4f6" }]}
                  onPress={() => router.push(`/alert/${a.id}`)}
                >
                  <View>
                    <Text style={[styles.miniTitle, { color: colors.text }]}>{a.symbol}</Text>
                    <Text style={[styles.miniSub, { color: colors.subtext }]}>
                      {fmtRule(a.rule)} ${a.target.toFixed(2)} · {a.enabled ? "Enabled" : "Disabled"}
                    </Text>
                  </View>

                  <Text style={[styles.miniCta, { color: colors.tint }]}>Edit</Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.subActionsRow}>
            <Pressable style={[styles.linkBtn, { borderColor: colors.border }]} onPress={() => router.push("/(tabs)/alerts")}>
              <Text style={[styles.linkBtnText, { color: colors.text }]}>Open Alerts</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ paddingHorizontal: 4, paddingTop: 2, paddingBottom: 28 }}>
          <Text style={[styles.footerNote, { color: colors.subtext }]}>
            Demo note: market hours ignore US holidays. Data is stored locally on device.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// 样式集中定义区域
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 18, gap: 14 },

  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  appName: { fontSize: 34, fontWeight: "800", letterSpacing: -0.5 },
  time: { marginTop: 6, fontSize: 15 },

  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  pillText: { fontSize: 13, fontWeight: "600" },

  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 14, fontWeight: "700" },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: "800" },

  marketMain: { marginTop: 10, fontSize: 22, fontWeight: "800", letterSpacing: -0.2 },
  meta: { fontSize: 13, fontWeight: "600" },

  quickActionsRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  actionBtnText: { fontSize: 14, fontWeight: "800" },
  actionBtnPrimary: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  actionBtnPrimaryText: { fontSize: 14, fontWeight: "900" },
  
  quickCreateRow: { flexDirection: "row", gap: 10, marginTop: 10, alignItems: "center" },
  input: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: "700",
  },
  goBtn: { height: 46, paddingHorizontal: 16, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  goBtnText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  hint: { marginTop: 10, fontSize: 12, lineHeight: 16 },

  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  chipText: { fontSize: 14, fontWeight: "900" },

  emptyLine: { marginTop: 10, fontSize: 13, lineHeight: 18 },

  miniRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    
  },
  miniTitle: { fontSize: 15, fontWeight: "900" },
  miniSub: { marginTop: 4, fontSize: 12, fontWeight: "600" },
  miniCta: { fontSize: 13, fontWeight: "900" },

  subActionsRow: { marginTop: 14, flexDirection: "row", justifyContent: "flex-end" },
  linkBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  linkBtnText: { fontSize: 13, fontWeight: "800" },
  
  footerNote: { fontSize: 12, lineHeight: 16, textAlign: "center" },
});
