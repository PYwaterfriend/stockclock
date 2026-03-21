import { useRouter } from "expo-router";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";  
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertsContext, ThemeContext, type AlertItem } from "../_layout";  // 引入当前页面需要的路由, React hooks, React Native 组件,屏幕安全区信息，以及全局的提醒数据和主题配置

// 将提醒规则从内部值转换为界面上显示的文字, ABOVE 显示为 Above，其他情况显示为 Below
function fmtRule(rule: AlertItem["rule"]) {
  return rule === "ABOVE" ? "Above" : "Below";
}

// 把时间戳转换成相对时间文本，供界面显示“几秒前 / 几分钟前 / 几小时前 / 几天前”
function relTime(ts: number) {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// 自定义搜索图标组件
function SearchIcon({ color }: { color: string }) {
  return (
    <View style={styles.searchIcon}>
      <View style={[styles.searchCircle, { borderColor: color }]} />
      <View style={[styles.searchHandle, { backgroundColor: color }]} />
    </View>
  );
}

// 自定义加号图标组件，用于“Add”按钮
function PlusIcon({ color }: { color: string }) {
  return (
    <View style={styles.plusIcon}>
      <View style={[styles.plusHorizontal, { backgroundColor: color }]} />
      <View style={[styles.plusVertical, { backgroundColor: color }]} />
    </View>
  );
}

// 自定义铃铛图标组件，表示提醒功能
function BellIcon({ color }: { color: string }) {
  return (
    <View style={styles.bellIcon}>
      <View style={[styles.bellBody, { backgroundColor: color }]} />
      <View style={[styles.bellClapper, { backgroundColor: color }]} />
    </View>
  );
}

// 通用开关组件，用来切换提醒启用/禁用状态
function ToggleSwitch({
  enabled,
  onToggle,
  tint,
  trackOff,
  thumb,
}: {
  enabled: boolean;
  onToggle: (e?: any) => void;
  tint: string;
  trackOff: string;
  thumb: string;
}) {
  return (
    <Pressable
      style={[styles.toggleTrack, { backgroundColor: enabled ? tint : trackOff }]}
      onPress={(e) => {
        e?.stopPropagation?.();
        onToggle(e);
      }}
      hitSlop={10}
    >
      <View
        style={[
          styles.toggleThumb,
          { backgroundColor: thumb },
          enabled && styles.toggleThumbEnabled,
        ]}
      />
    </Pressable>
  );
}

// 演示模式下的顶部提示框组件
function DemoToast({
  visible,
  title,
  body,
  topInset,
  colors,
}: {
  visible: boolean;
  title: string;
  body: string;
  topInset: number;
  colors: { card: string; border: string; text: string; subtext: string; tint: string };
}) {
  const translateY = useRef(new Animated.Value(-36)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.98)).current;

  // 控制提示框显示和隐藏时的位移、透明度、缩放动画
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -24,
          duration: 180,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.98,
          duration: 180,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, opacity, scale, translateY]);

  // 如果当前不显示提示框，直接不渲染
  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.demoToast,
        {
          top: topInset + 18,
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowColor: "#000",
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <Text style={[styles.demoToastTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.demoToastBody, { color: colors.subtext }]}>{body}</Text>
    </Animated.View>
  );
}

// 单个提醒卡片组件,负责展示股票代码、触发条件、更新时间，以及编辑、删除、测试触发等操作
function AlertCard({
  alert,
  onToggle,
  onEdit,
  onDelete,
  onDemoTrigger,
  demoMode,
  lastDemoAt,
  colors,
  scheme,
}: {
  alert: AlertItem;
  onToggle: (e?: any) => void;
  onEdit: () => void;
  onDelete: (e?: any) => void;
  onDemoTrigger: (e?: any) => void;
  demoMode: boolean;
  lastDemoAt?: number;
  colors: { card: string; border: string; text: string; subtext: string; tint: string; danger: string };
  scheme: "dark" | "light";
}) {
  // 根据提醒规则决定卡片中显示的文字和颜色,ABOVE 用绿色表示，BELOW 用橙色表示，方便用户快速区分提醒方向
  const conditionText = fmtRule(alert.rule);
  const conditionColor = alert.rule === "ABOVE" ? "#34c759" : "#ff9500";
  const sub = scheme === "dark" ? "rgba(255,255,255,0.35)" : "rgba(17,24,39,0.55)";

  return (
    // 外层整个卡片可点击，点击后进入该提醒的编辑页面
    <Pressable style={styles.alertCardPress} onPress={onEdit}>
      <View
        style={[
          styles.alertCard,
          { backgroundColor: colors.card, borderColor: colors.border },
          !alert.enabled && styles.alertCardDisabled,
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.symbolContainer}>
            <Text style={[styles.symbolText, { color: colors.text }]}>{alert.symbol}</Text>
            <View
              style={[styles.conditionBadge, { backgroundColor: `${conditionColor}20` }]}
            >
              <Text style={[styles.conditionText, { color: conditionColor }]}>
                {conditionText} ${alert.target.toFixed(2)}
              </Text>
            </View>
          </View>

          <ToggleSwitch // 提醒开关区域，用于快速启用或停用当前提醒，不需要进入编辑页
            enabled={alert.enabled}
            onToggle={() => onToggle()}
            tint={conditionColor}
            trackOff={scheme === "dark" ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"}
            thumb="#ffffff"
          />
        </View>

        <View style={styles.cardMetaRow}>
          <Text style={[styles.lastUpdatedText, { color: sub }]}>
            Updated {relTime(alert.createdAt)}
          </Text>
          {!!lastDemoAt && (
            <Text style={[styles.demoMetaText, { color: colors.tint }]}>
              Demo triggered {relTime(lastDemoAt)}
            </Text>
          )}
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.footerActions}>
            {demoMode && ( // 演示模式打开时，额外显示Test Trigger按钮，方便课堂演示提醒触发流程
              <Pressable
                style={[
                  styles.editButton,
                  { backgroundColor: `${colors.tint}22`, borderColor: `${colors.tint}55` },
                ]}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  onDemoTrigger(e);
                }}
              >
                <Text style={[styles.editButtonText, { color: colors.tint }]}>Test Trigger</Text>
              </Pressable>
            )}

            <Pressable
              style={[
                styles.editButton,
                {
                  backgroundColor:
                    scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                },
              ]}
              onPress={onEdit}
            >
              <Text style={[styles.editButtonText, { color: colors.text }]}>Edit</Text>
            </Pressable>

            <Pressable
              style={[styles.editButton, { backgroundColor: `${colors.danger}22` }]}
              onPress={(e) => {
                e?.stopPropagation?.();
                onDelete(e);
              }}
            >
              <Text style={[styles.editButtonText, { color: colors.text }]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// 空状态组件,当当前没有任何提醒时，显示引导文案和创建第一个提醒的按钮
function EmptyState({
  onCreateAlert,
  scheme,
}: {
  onCreateAlert: () => void;
  scheme: "dark" | "light";
}) {
  const { colors } = useContext(ThemeContext);
  const iconColor = scheme === "dark" ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.25)";

  return (
    <View style={styles.emptyState}>
      <View
        style={[
          styles.emptyIconContainer,
          {
            backgroundColor:
              scheme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
          },
        ]}
      >
        <BellIcon color={iconColor} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No alerts yet</Text>
      <Text style={[styles.emptyDescription, { color: colors.subtext }]}>
        Create an alert to get notified on price moves
      </Text>
      <Pressable
        style={[styles.emptyButton, { backgroundColor: colors.tint }]}
        onPress={onCreateAlert}
      >
        <Text style={styles.emptyButtonText}>Create your first alert</Text>
      </Pressable>
    </View>
  );
}

// Alerts 页面主组件,管理提醒列表、搜索、创建弹窗、演示模式、测试提醒记录等页面级状态
export default function AlertsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { alerts, toggleAlertEnabled, removeAlert } = useContext(AlertsContext); // 从全局上下文中读取提醒数据和主题信息,这样页面能拿到当前所有提醒,以及深色/浅色模式的配色
  const { colors, resolvedScheme } = useContext(ThemeContext);

  // 页面内部状态
  const [searchQuery, setSearchQuery] = useState(""); //控制搜索输入，showAdd 控制创建弹窗显示
  const [showAdd, setShowAdd] = useState(false);
  const [draftSymbol, setDraftSymbol] = useState(""); //暂存新建提醒时输入的股票代码
  const [demoMode, setDemoMode] = useState(true); //控制课堂演示模式，demoToast 控制顶部提示框
  const [demoToast, setDemoToast] = useState<{
    visible: boolean;
    title: string;
    body: string;
  }>({
    visible: false,
    title: "",
    body: "",
  });
  const [demoHistory, setDemoHistory] = useState<Record<string, number>>({}); //记录每个提醒最近一次测试触发时间

  // 顶部演示提示框在显示一段时间后自动关闭，避免一直停留在界面上
  useEffect(() => {
    if (!demoToast.visible) return;
    const timer = setTimeout(() => {
      setDemoToast((prev) => ({ ...prev, visible: false }));
    }, 2600);
    return () => clearTimeout(timer);
  }, [demoToast.visible]);

  // 根据搜索关键词筛选提醒列表
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    if (!q) return alerts;
    return alerts.filter((a) => a.symbol.includes(q));
  }, [alerts, searchQuery]);

  // 打开“创建提醒”流程
  const openCreate = (sym?: string) => {
    const s = (sym ?? "").trim().toUpperCase();
    setShowAdd(false);
    setDraftSymbol("");
    router.push({ pathname: "/alert/create", params: { symbol: s } });
  };

  // 模拟一次提醒触发，用于课堂演示
  function triggerDemoAlert(alert: AlertItem) {
    const action = alert.rule === "ABOVE" ? "rose above" : "fell below";
    const simulatedPrice =
      alert.rule === "ABOVE" ? alert.target + 0.12 : Math.max(0.01, alert.target - 0.12);

    setDemoHistory((prev) => ({
      ...prev,
      [alert.id]: Date.now(),
    }));

    setDemoToast({
      visible: true,
      title: `${alert.symbol} alert triggered`,
      body: `${alert.symbol} ${action} $${alert.target.toFixed(
        2
      )}. Demo price: $${simulatedPrice.toFixed(2)}`,
    });
  }

  // 根据当前明暗主题动态生成输入框占位色、图标颜色和搜索框背景色
  const placeholder =
    resolvedScheme === "dark" ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";
  const icon = resolvedScheme === "dark" ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.40)";
  const searchBg =
    resolvedScheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  // 页面根布局
  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <DemoToast
        visible={demoToast.visible}
        title={demoToast.title}
        body={demoToast.body}
        topInset={insets.top}
        colors={colors}
      />

      <View style={styles.header}> 
        <Text style={[styles.title, { color: colors.text }]}>Alerts</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={[
              styles.demoModeButton,
              {
                backgroundColor: demoMode ? `${colors.tint}22` : searchBg,
                borderColor: demoMode ? `${colors.tint}55` : colors.border,
              },
            ]}
            onPress={() => setDemoMode((prev) => !prev)}
          >
            <Text
              style={[
                styles.demoModeButtonText,
                { color: demoMode ? colors.tint : colors.subtext },
              ]}
            >
              Demo {demoMode ? "On" : "Off"}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.addButton, { backgroundColor: `${colors.tint}22` }]}
            onPress={() => setShowAdd(true)}
          >
            <PlusIcon color={colors.tint} />
            <Text style={[styles.addButtonText, { color: colors.tint }]}>Add</Text>
          </Pressable>
        </View>
      </View>

      {demoMode && (
        <View // 演示模式说明卡片
          style={[
            styles.demoHintCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.demoHintTitle, { color: colors.text }]}>
            Demo mode is enabled
          </Text>
          <Text style={[styles.demoHintText, { color: colors.subtext }]}>
            Use “Test Trigger” on any alert to show the alert workflow instantly during class.
          </Text>
        </View>
      )}

      <View style={[styles.searchContainer, { backgroundColor: searchBg }]}> 
        <SearchIcon color={icon} /> 
        <TextInput // 搜索栏区域
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search by symbol..."
          placeholderTextColor={placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="characters"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery("")} hitSlop={10}>
            <Text style={[styles.clearButton, { color: colors.subtext }]}>Clear</Text>
          </Pressable>
        )}
      </View>

      {filtered.length === 0 ? ( // 如果筛选后没有提醒,则显示空状态,否则显示提醒列表
        <EmptyState onCreateAlert={() => setShowAdd(true)} scheme={resolvedScheme} />
      ) : (
        <ScrollView
          style={styles.listContainer}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {filtered.map((a) => ( // 遍历渲染每一条提醒卡片
            <AlertCard
              key={a.id}
              alert={a}
              onToggle={() => toggleAlertEnabled(a.id)}
              onEdit={() => router.push(`/alert/${a.id}`)}
              onDelete={() => removeAlert(a.id)}
              onDemoTrigger={() => triggerDemoAlert(a)}
              demoMode={demoMode}
              lastDemoAt={demoHistory[a.id]}
              colors={colors}
              scheme={resolvedScheme}
            />
          ))}
        </ScrollView>
      )}

      {showAdd && ( // 新建提醒弹窗
        <Pressable
          style={[
            styles.modalOverlay,
            {
              backgroundColor:
                resolvedScheme === "dark" ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.35)",
            },
          ]}
          onPress={() => setShowAdd(false)}
        >
          <Pressable
            style={[
              styles.modalCard,
              {
                backgroundColor:
                  resolvedScheme === "dark" ? "rgba(20,20,20,0.98)" : "#ffffff",
                borderColor: colors.border,
              },
            ]}
            onPress={(e) => e?.stopPropagation?.()}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>Create alert</Text>
            <Text style={[styles.modalHint, { color: colors.subtext }]}>
              Enter a stock symbol
            </Text>

            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: searchBg,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              value={draftSymbol}
              onChangeText={setDraftSymbol}
              placeholder="e.g. AAPL"
              placeholderTextColor={placeholder}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={10}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtnGhost, styles.modalBtn]}
                onPress={() => setShowAdd(false)}
              >
                <Text style={[styles.modalBtnGhostText, { color: colors.subtext }]}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.tint }]}
                onPress={() => openCreate(draftSymbol)}
              >
                <Text style={styles.modalBtnText}>Next</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}

// 样式集中定义区
const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 } as ViewStyle,

  header: {
    paddingHorizontal: 20,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  } as ViewStyle,
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  title: { fontSize: 34, fontWeight: "700", letterSpacing: -0.5 } as TextStyle,

  demoModeButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  } as ViewStyle,
  demoModeButtonText: { fontSize: 14, fontWeight: "700" } as TextStyle,

  addButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  } as ViewStyle,
  addButtonText: { fontSize: 16, fontWeight: "600" } as TextStyle,
  
  demoHintCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  } as ViewStyle,
  demoHintTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 } as TextStyle,
  demoHintText: { fontSize: 13, lineHeight: 18 } as TextStyle,

  demoToast: {
    position: "absolute",
    left: 16,
    right: 16,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    zIndex: 50,
    elevation: 8,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  } as ViewStyle,
  demoToastTitle: { fontSize: 15, fontWeight: "800", marginBottom: 4 } as TextStyle,
  demoToastBody: { fontSize: 13, lineHeight: 18 } as TextStyle,

  searchContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  } as ViewStyle,
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
    marginLeft: 10,
  } as TextStyle,
  clearButton: { fontSize: 13, fontWeight: "500" } as TextStyle,

  listContainer: { flex: 1 } as ViewStyle,
  listContent: { paddingHorizontal: 20, paddingBottom: 34 } as ViewStyle,

  searchIcon: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  searchCircle: {
    width: 12,
    height: 12,
    borderRadius: 999,
    borderWidth: 2,
  } as ViewStyle,
  searchHandle: {
    width: 7,
    height: 2,
    transform: [{ rotate: "45deg" }, { translateX: 5 }, { translateY: -1 }],
    borderRadius: 999,
  } as ViewStyle,

  plusIcon: { width: 14, height: 14, alignItems: "center", justifyContent: "center" } as ViewStyle,
  plusHorizontal: {
    position: "absolute",
    width: 14,
    height: 2,
    borderRadius: 999,
  } as ViewStyle,
  plusVertical: {
    position: "absolute",
    width: 2,
    height: 14,
    borderRadius: 999,
  } as ViewStyle,

  bellIcon: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  bellBody: {
    width: 15,
    height: 12,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
  } as ViewStyle,
  bellClapper: {
    width: 4,
    height: 4,
    borderRadius: 999,
    marginTop: 2,
  } as ViewStyle,

  alertCardPress: { marginBottom: 14 } as ViewStyle,
  alertCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 14,
  } as ViewStyle,
  alertCardDisabled: { opacity: 0.55 } as ViewStyle,

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  } as ViewStyle,
  symbolContainer: { gap: 8, flexShrink: 1, paddingRight: 14 } as ViewStyle,
  symbolText: { fontSize: 24, fontWeight: "700", letterSpacing: -0.5 } as TextStyle,
  conditionBadge: {
    alignSelf: "flex-start",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  } as ViewStyle,
  conditionText: { fontSize: 13, fontWeight: "600" } as TextStyle,

  cardMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  } as ViewStyle,
  lastUpdatedText: { fontSize: 12 } as TextStyle,
  demoMetaText: { fontSize: 12, fontWeight: "700" } as TextStyle,

  cardFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  } as ViewStyle,
  footerActions: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  } as ViewStyle,
  editButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
  } as ViewStyle,
  editButtonText: { fontSize: 13, fontWeight: "600" } as TextStyle,

  toggleTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: "center",
  } as ViewStyle,
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
  } as ViewStyle,
  toggleThumbEnabled: { alignSelf: "flex-end" } as ViewStyle,

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingBottom: 80,
  } as ViewStyle,
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  } as ViewStyle,
  emptyTitle: { fontSize: 22, fontWeight: "600", marginBottom: 8 } as TextStyle,
  emptyDescription: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  } as TextStyle,
  emptyButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  } as ViewStyle,
  emptyButtonText: { fontSize: 16, fontWeight: "600", color: "#ffffff" } as TextStyle,

  modalOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingHorizontal: 18,
  } as ViewStyle,
  modalCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  } as ViewStyle,
  modalTitle: { fontSize: 18, fontWeight: "700" } as TextStyle,
  modalHint: { marginTop: 6, fontSize: 13 } as TextStyle,
  modalInput: {
    marginTop: 12,
    height: 46,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    borderWidth: 1,
  } as any,
  modalActions: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  } as ViewStyle,
  modalBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  } as ViewStyle,
  modalBtnText: { color: "#fff", fontWeight: "700" } as TextStyle,
  modalBtnGhost: {} as ViewStyle,
  modalBtnGhostText: { fontWeight: "700" } as TextStyle,
});
