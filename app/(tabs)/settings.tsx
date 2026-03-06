import React, { useContext } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { ThemeContext, type ThemePref } from "../_layout";

function OptionRow({
  title,
  desc,
  value,
}: {
  title: string;
  desc: string;
  value: ThemePref;
}) {
  const { themePref, setThemePref, colors } = useContext(ThemeContext);
  const active = themePref === value;

  return (
    <Pressable
      style={[
        styles.row,
        { backgroundColor: colors.card, borderColor: colors.border },
        active && { borderColor: colors.tint },
      ]}
      onPress={() => setThemePref(value)}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.rowDesc, { color: colors.subtext }]}>{desc}</Text>
      </View>

      <View
        style={[
          styles.check,
          { borderColor: colors.border, backgroundColor: "transparent" },
          active && { borderColor: colors.tint, backgroundColor: `${colors.tint}22` },
        ]}
      >
        {active && <Text style={[styles.checkText, { color: colors.tint }]}>✓</Text>}
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { resolvedScheme, colors } = useContext(ThemeContext);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
      <Text style={[styles.subtitle, { color: colors.subtext }]}>Theme (current: {resolvedScheme})</Text>

      <View style={styles.block}>
        <OptionRow title="System" desc="Follow device appearance" value="system" />
        <OptionRow title="Dark" desc="Always use dark UI" value="dark" />
        <OptionRow title="Light" desc="Always use light UI" value="light" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 } as ViewStyle,
  title: { fontSize: 34, fontWeight: "700", letterSpacing: -0.5 } as TextStyle,
  subtitle: { marginTop: 6, fontSize: 14 } as TextStyle,

  block: { marginTop: 18, gap: 12 } as ViewStyle,

  row: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  } as ViewStyle,
  rowTitle: { fontSize: 16, fontWeight: "700" } as TextStyle,
  rowDesc: { marginTop: 4, fontSize: 13, lineHeight: 18 } as TextStyle,

  check: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  checkText: { fontSize: 16, fontWeight: "800" } as TextStyle,
});
