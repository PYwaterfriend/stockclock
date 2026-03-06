import React, { useContext, useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, type ViewStyle, type TextStyle } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AlertsContext, ThemeContext } from "../_layout";

export default function CreateAlertScreen() {
  const router = useRouter();
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const sym = (symbol ?? "").toUpperCase();

  const { addAlert } = useContext(AlertsContext);
  const { colors, resolvedScheme } = useContext(ThemeContext);

  const [rule, setRule] = useState<"ABOVE" | "BELOW">("ABOVE");
  const [target, setTarget] = useState("");

  const placeholder = useMemo(
    () => (resolvedScheme === "dark" ? "rgba(255,255,255,0.35)" : "rgba(17,24,39,0.35)"),
    [resolvedScheme]
  );

  const pillActiveBg = resolvedScheme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)";

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.text }]}>Create Alert</Text>
      <Text style={[styles.subtitle, { color: colors.subtext }]}>Symbol: {sym || "N/A"}</Text>

      <Text style={[styles.label, { color: colors.subtext }]}>Condition</Text>
      <View style={styles.row}>
        <Pressable
          style={[
            styles.pill,
            { borderColor: colors.border },
            rule === "ABOVE" && { backgroundColor: pillActiveBg, borderColor: colors.tint },
          ]}
          onPress={() => setRule("ABOVE")}
        >
          <Text style={[styles.pillText, { color: colors.text }]}>Above</Text>
        </Pressable>

        <Pressable
          style={[
            styles.pill,
            { borderColor: colors.border },
            rule === "BELOW" && { backgroundColor: pillActiveBg, borderColor: colors.tint },
          ]}
          onPress={() => setRule("BELOW")}
        >
          <Text style={[styles.pillText, { color: colors.text }]}>Below</Text>
        </Pressable>
      </View>

      <Text style={[styles.label, { color: colors.subtext }]}>Target Price</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
        value={target}
        onChangeText={setTarget}
        placeholder="e.g. 130.00"
        placeholderTextColor={placeholder}
        keyboardType="decimal-pad"
      />

      <Pressable
        style={[styles.primaryButton, { backgroundColor: colors.tint }]}
        onPress={() => {
          const t = Number(target);
          if (!sym || !Number.isFinite(t)) return;

          addAlert({
            symbol: sym,
            rule,
            target: t,
            enabled: true,
          });

          router.back();
        }}
      >
        <Text style={styles.primaryButtonText}>Save</Text>
      </Pressable>

      <Pressable onPress={() => router.back()}>
        <Text style={[styles.back, { color: colors.subtext }]}>Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 } as ViewStyle,
  title: { fontSize: 28, fontWeight: "800", marginBottom: 8 } as TextStyle,
  subtitle: { fontSize: 14, marginBottom: 18 } as TextStyle,
  label: { fontSize: 14, fontWeight: "700", marginBottom: 8 } as TextStyle,

  row: { flexDirection: "row", gap: 10, marginBottom: 16 } as ViewStyle,
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  } as ViewStyle,
  pillText: { fontSize: 14, fontWeight: "800" } as TextStyle,

  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  } as TextStyle,

  primaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 14,
  } as ViewStyle,
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" } as TextStyle,
  back: { textAlign: "center" } as TextStyle,
});
