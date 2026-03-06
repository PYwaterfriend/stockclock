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
import { AlertsContext, ThemeContext, type AlertItem } from "../_layout";

function fmtRule(rule: AlertItem["rule"]) {
  return rule === "ABOVE" ? "Above" : "Below";
}

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

function SearchIcon({ color }: { color: string }) {
  return (
    <View style={styles.searchIcon}>
      <View style={[styles.searchCircle, { borderColor: color }]} />
      <View style={[styles.searchHandle, { backgroundColor: color }]} />
    </View>
  );
}

function PlusIcon({ color }: { color: string }) {
  return (
    <View style={styles.plusIcon}>
      <View style={[styles.plusHorizontal, { backgroundColor: color }]} />
      <View style={[styles.plusVertical, { backgroundColor: color }]} />
    </View>
  );
}

function BellIcon({ color }: { color: string }) {
  return (
    <View style={styles.bellIcon}>
      <View style={[styles.bellBody, { backgroundColor: color }]} />
      <View style={[styles.bellClapper, { backgroundColor: color }]} />
    </View>
  );
}

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
  const conditionText = fmtRule(alert.rule);
  const conditionColor = alert.rule === "ABOVE" ? "#34c759" : "#ff9500";
  const sub = scheme === "dark" ? "rgba(255,255,255,0.35)" : "rgba(17,24,39,0.55)";

  return (
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

          <ToggleSwitch
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
            {demoMode && (
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

export default function AlertsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { alerts, toggleAlertEnabled, removeAlert } = useContext(AlertsContext);
  const { colors, resolvedScheme } = useContext(ThemeContext);

  const [searchQuery, setSearchQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [draftSymbol, setDraftSymbol] = useState("");
  const [demoMode, setDemoMode] = useState(true);
  const [demoToast, setDemoToast] = useState<{
    visible: boolean;
    title: string;
    body: string;
  }>({
    visible: false,
    title: "",
    body: "",
  });
  const [demoHistory, setDemoHistory] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!demoToast.visible) return;
    const timer = setTimeout(() => {
      setDemoToast((prev) => ({ ...prev, visible: false }));
    }, 2600);
    return () => clearTimeout(timer);
  }, [demoToast.visible]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    if (!q) return alerts;
    return alerts.filter((a) => a.symbol.includes(q));
  }, [alerts, searchQuery]);

  const openCreate = (sym?: string) => {
    const s = (sym ?? "").trim().toUpperCase();
    setShowAdd(false);
    setDraftSymbol("");
    router.push({ pathname: "/alert/create", params: { symbol: s } });
  };

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

  const placeholder =
    resolvedScheme === "dark" ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";
  const icon = resolvedScheme === "dark" ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.40)";
  const searchBg =
    resolvedScheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

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
        <View
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
        <TextInput
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

      {filtered.length === 0 ? (
        <EmptyState onCreateAlert={() => setShowAdd(true)} scheme={resolvedScheme} />
      ) : (
        <ScrollView
          style={styles.listContainer}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {filtered.map((a) => (
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

      {showAdd && (
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
