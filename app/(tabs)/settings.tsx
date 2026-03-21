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

// 通用分区组件，用于渲染每个分组的标题和卡片
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useContext(ThemeContext); // 读取当前主题颜色
  return (
    <View style={styles.sectionWrap}>
      <Text style={[styles.sectionTitle, { color: colors.subtext }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

// 主题选项行组件
function ThemeOptionRow({ title, desc, value }: { title: string; desc: string; value: ThemePref }) {
  const { themePref, setThemePref, colors } = useContext(ThemeContext);
  const active = themePref === value; // 判断当前这一项是否为已选中的主题模式

  return (
    <Pressable // 点击整行后切换主题偏好
      style={[styles.row, styles.rowSpaced, active && { backgroundColor: `${colors.tint}10` }]}
      onPress={() => setThemePref(value)}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.rowDesc, { color: colors.subtext }]}>{desc}</Text>
      </View>
      <View // 右侧圆形标记用于显示当前主题项是否被选中
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

// 开关设置行组件
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

  return ( // 左侧显示该设置项的标题和功能说明
    <View style={[styles.row, styles.rowSpaced]}>
      <View style={{ flex: 1, paddingRight: 12 }}> 
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.rowDesc, { color: colors.subtext }]}>{desc}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: `${colors.tint}66`, false: colors.border }} thumbColor={value ? colors.tint : undefined} />
    </View>
  );
}

// 分段选择组件
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
        {options.map((option) => { // 遍历渲染所有候选
          const active = option.value === value; // 判断当前按钮是否为选中状态
          return (
            <Pressable // 单个可选按钮
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

// 设置页面主组件，包括展示主题，数据，默认图表和新闻
export default function SettingsScreen() {
  const { resolvedScheme, colors } = useContext(ThemeContext);
  const { settings, updateSettings } = useContext(SettingsContext);

  // 页面主体
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
        <ToggleRow // 智能数据模式
          title="Smart Data Mode"
          desc="Reuse saved market data after U.S. market close to reduce API calls."
          value={settings.smartDataMode}
          onChange={(smartDataMode) => updateSettings({ smartDataMode })}
        />
        <ToggleRow // 离线缓存回退开关
          title="Use Cached Data When Offline"
          desc="Fall back to saved quote, chart, and news data when refresh fails."
          value={settings.useCachedDataWhenOffline}
          onChange={(useCachedDataWhenOffline) => updateSettings({ useCachedDataWhenOffline })}
        />
        <SegmentRow<AutoRefreshSeconds> // 自动刷新设置
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
        <SegmentRow<DefaultChartRange>  // 默认图表周期设置
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
          value={settings.newsItemsPerStock} // 每只股票的新闻条数设置
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

// 样式定义区
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
