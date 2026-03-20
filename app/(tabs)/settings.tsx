import React, { useContext } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  Pressable,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import {
  SettingsContext,
  ThemeContext,
  type AutoRefreshSeconds,
  type DefaultChartRange,
  type NewsItemsPerStock,
  type ThemePref,
} from "../_layout";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useContext(ThemeContext);
  return (
    <View style={styles.sectionWrap}>
      <Text style={[styles.sectionTitle, { color: colors.subtext }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function ThemeOptionRow({ title, desc, value }: { title: string; desc: string; value: ThemePref }) {
  const { themePref, setThemePref, colors } = useContext(ThemeContext);
  const active = themePref === value;

  return (
    <Pressable
      style={[styles.row, styles.rowSpaced, active && { backgroundColor: `${colors.tint}10` }]}
      onPress={() => setThemePref(value)}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.rowDesc, { color: colors.subtext }]}>{desc}</Text>
      </View>
      <View
        style={[
          styles.check,
          { borderColor: active ? colors.tint : colors.border, backgroundColor: active ? `${colors.tint}22` : "transparent" },
        ]}
      >
        {active && <Text style={[styles.checkText, { color: colors.tint }]}>✓</Text>}
      </View>
    </Pressable>
  );
}

function ToggleRow({
  title,
  desc,
  value,
  onChange,
}: {
  title: string;
  desc: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const { colors } = useContext(ThemeContext);

  return (
    <View style={[styles.row, styles.rowSpaced]}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.rowDesc, { color: colors.subtext }]}>{desc}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: `${colors.tint}66`, false: colors.border }} thumbColor={value ? colors.tint : undefined} />
    </View>
  );
}

function SegmentRow<T extends string | number>({
  title,
  desc,
  value,
  options,
  onChange,
}: {
  title: string;
  desc: string;
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (next: T) => void;
}) {
  const { colors } = useContext(ThemeContext);

  return (
    <View style={styles.row}>
      <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.rowDesc, { color: colors.subtext }]}>{desc}</Text>
      <View style={styles.segmentWrap}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              style={[
                styles.segmentBtn,
                {
                  backgroundColor: active ? colors.tint : colors.bg,
                  borderColor: active ? colors.tint : colors.border,
                },
              ]}
              onPress={() => onChange(option.value)}
            >
              <Text style={[styles.segmentText, { color: active ? "#fff" : colors.text }]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const { resolvedScheme, colors } = useContext(ThemeContext);
  const { settings, updateSettings } = useContext(SettingsContext);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.contentContainer}>
      <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
      <Text style={[styles.subtitle, { color: colors.subtext }]}>Tune visuals, chart defaults, and API behavior for demos.</Text>

      <Section title="Appearance">
        <ThemeOptionRow title="System" desc={`Follow device appearance. Current: ${resolvedScheme}`} value="system" />
        <ThemeOptionRow title="Dark" desc="Always use dark UI" value="dark" />
        <ThemeOptionRow title="Light" desc="Always use light UI" value="light" />
      </Section>

      <Section title="Data & API">
        <ToggleRow
          title="Smart Data Mode"
          desc="Reuse saved market data after U.S. market close to reduce API calls."
          value={settings.smartDataMode}
          onChange={(smartDataMode) => updateSettings({ smartDataMode })}
        />
        <ToggleRow
          title="Use Cached Data When Offline"
          desc="Fall back to saved quote, chart, and news data when refresh fails."
          value={settings.useCachedDataWhenOffline}
          onChange={(useCachedDataWhenOffline) => updateSettings({ useCachedDataWhenOffline })}
        />
        <SegmentRow<AutoRefreshSeconds>
          title="Auto Refresh"
          desc="How often the stock detail page refreshes live data."
          value={settings.autoRefreshSeconds}
          options={[
            { label: "Off", value: 0 },
            { label: "15s", value: 15 },
            { label: "30s", value: 30 },
            { label: "60s", value: 60 },
          ]}
          onChange={(autoRefreshSeconds) => updateSettings({ autoRefreshSeconds })}
        />
      </Section>

      <Section title="Charts">
        <SegmentRow<DefaultChartRange>
          title="Default Chart Range"
          desc="Initial chart timeframe when opening a stock detail page."
          value={settings.defaultChartRange}
          options={[
            { label: "1D", value: "1D" },
            { label: "1W", value: "1W" },
            { label: "1M", value: "1M" },
            { label: "1Y", value: "1Y" },
          ]}
          onChange={(defaultChartRange) => updateSettings({ defaultChartRange })}
        />
      </Section>

      <Section title="News">
        <SegmentRow<NewsItemsPerStock>
          title="News Items Per Stock"
          desc="How many recent articles to show for each stock."
          value={settings.newsItemsPerStock}
          options={[
            { label: "3", value: 3 },
            { label: "5", value: 5 },
            { label: "10", value: 10 },
          ]}
          onChange={(newsItemsPerStock) => updateSettings({ newsItemsPerStock })}
        />
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 } as ViewStyle,
  contentContainer: { padding: 20, paddingTop: 56, paddingBottom: 40 } as ViewStyle,
  title: { fontSize: 34, fontWeight: "700", letterSpacing: -0.5 } as TextStyle,
  subtitle: { marginTop: 6, fontSize: 14, lineHeight: 20 } as TextStyle,
  sectionWrap: { marginTop: 22 } as ViewStyle,
  sectionTitle: { marginBottom: 10, fontSize: 13, fontWeight: "700", letterSpacing: 0.3, textTransform: "uppercase" } as TextStyle,
  sectionCard: { borderWidth: 1, borderRadius: 18, overflow: "hidden" } as ViewStyle,
  row: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(127,127,127,0.22)", gap: 8 } as ViewStyle,
  rowSpaced: { flexDirection: "row", alignItems: "center" } as ViewStyle,
  rowTitle: { fontSize: 16, fontWeight: "700" } as TextStyle,
  rowDesc: { fontSize: 13, lineHeight: 18 } as TextStyle,
  check: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center" } as ViewStyle,
  checkText: { fontSize: 16, fontWeight: "800" } as TextStyle,
  segmentWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 } as ViewStyle,
  segmentBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 } as ViewStyle,
  segmentText: { fontSize: 13, fontWeight: "700" } as TextStyle,
});
