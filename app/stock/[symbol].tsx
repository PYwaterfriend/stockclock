import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import {
  fetchQuote,
  fetchTimeSeries,
  formatVolume,
  hasConfiguredApiKey,
  type QuoteData,
  type TimePoint,
} from "../../services/marketData";
import { ThemeContext, WatchlistContext } from "../_layout";

const timeRanges = ["1D", "1W", "1M", "6M", "1Y"] as const;
type TimeRange = (typeof timeRanges)[number];

function StatItem({
  label,
  value,
  subtext,
  text,
}: {
  label: string;
  value: string;
  subtext: string;
  text: string;
}) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statLabel, { color: subtext }]}>{label}</Text>
      <Text style={[styles.statValue, { color: text }]}>{value}</Text>
    </View>
  );
}

function shortDateLabel(value: string) {
  if (!value) return "";
  const dayPart = value.slice(0, 10);
  const timePart = value.length >= 16 ? value.slice(11, 16) : "";
  return timePart || dayPart;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function ChartLine({
  points,
  border,
  tint,
  text,
  subtext,
  surface,
}: {
  points: TimePoint[];
  border: string;
  tint: string;
  text: string;
  subtext: string;
  surface: string;
}) {
  const width = 340;
  const height = 220;
  const leftPad = 52;
  const rightPad = 14;
  const topPad = 18;
  const bottomPad = 34;
  const innerWidth = width - leftPad - rightPad;
  const innerHeight = height - topPad - bottomPad;

  const safePoints = points.length > 0 ? points : [{ datetime: "0", close: 0 }];
  const values = safePoints.map((p) => p.close);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const spread = Math.max(1, max - min);

  const plotted = safePoints.map((point, index) => {
    const x =
      safePoints.length === 1
        ? leftPad + innerWidth / 2
        : leftPad + (index / (safePoints.length - 1)) * innerWidth;
    const y = topPad + ((max - point.close) / spread) * innerHeight;
    return { ...point, x, y };
  });

  const path = plotted
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const highPoint = plotted.reduce((best, current) =>
    current.close > best.close ? current : best
  );
  const lowPoint = plotted.reduce((best, current) =>
    current.close < best.close ? current : best
  );

  const firstPoint = plotted[0];
  const lastPoint = plotted[plotted.length - 1];
  const isUp = lastPoint.close >= firstPoint.close;
  const lineColor = isUp ? tint : "#ff6b6b";

  const yTicks = [
    max,
    max - spread * 0.25,
    max - spread * 0.5,
    max - spread * 0.75,
    min,
  ];

  const xTickIndexes =
    safePoints.length <= 2
      ? [0, safePoints.length - 1]
      : [0, Math.floor((safePoints.length - 1) / 2), safePoints.length - 1];

  const highLabel = `$${highPoint.close.toFixed(2)}`;
  const lowLabel = `$${lowPoint.close.toFixed(2)}`;
  const highLabelWidth = Math.max(58, highLabel.length * 7.3);
  const lowLabelWidth = Math.max(58, lowLabel.length * 7.3);
  const labelHeight = 18;

  const highBoxX = clamp(
    highPoint.x + 14,
    leftPad + 8,
    width - rightPad - highLabelWidth - 4
  );
  const highBoxY = clamp(highPoint.y - 24, 4, height - labelHeight - 4);

  const lowBoxX = clamp(
    lowPoint.x + 14,
    leftPad + 8,
    width - rightPad - lowLabelWidth - 4
  );
  const lowBoxY = clamp(lowPoint.y + 8, 4, height - labelHeight - 4);

  return (
    <View style={[styles.chartBox, { borderColor: border, backgroundColor: surface }]}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Rect x={0} y={0} width={width} height={height} rx={16} fill="transparent" />

        {yTicks.map((tickValue, index) => {
          const y = topPad + (index / (yTicks.length - 1)) * innerHeight;
          return (
            <React.Fragment key={`y-${index}`}>
              <Line
                x1={leftPad}
                y1={y}
                x2={width - rightPad}
                y2={y}
                stroke={border}
                strokeOpacity={0.3}
                strokeDasharray="4 4"
              />
              <SvgText
                x={8}
                y={y + 4}
                fill={subtext}
                fontSize="10"
                fontWeight="600"
              >
                ${tickValue.toFixed(2)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {xTickIndexes.map((pointIndex, index) => {
          const point = plotted[pointIndex];
          return (
            <React.Fragment key={`x-${index}`}>
              <Line
                x1={point.x}
                y1={topPad}
                x2={point.x}
                y2={topPad + innerHeight}
                stroke={border}
                strokeOpacity={0.18}
                strokeDasharray="4 4"
              />
              <SvgText
                x={point.x}
                y={height - 8}
                fill={subtext}
                fontSize="10"
                fontWeight="600"
                textAnchor="middle"
              >
                {shortDateLabel(point.datetime)}
              </SvgText>
            </React.Fragment>
          );
        })}

        <Line
          x1={leftPad}
          y1={topPad}
          x2={leftPad}
          y2={topPad + innerHeight}
          stroke={border}
          strokeOpacity={0.55}
        />
        <Line
          x1={leftPad}
          y1={topPad + innerHeight}
          x2={width - rightPad}
          y2={topPad + innerHeight}
          stroke={border}
          strokeOpacity={0.55}
        />

        <Path
          d={path}
          fill="none"
          stroke={lineColor}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {plotted.map((point) => (
          <Circle key={point.datetime} cx={point.x} cy={point.y} r={2.6} fill={lineColor} />
        ))}

        <Circle cx={highPoint.x} cy={highPoint.y} r={4.6} fill={lineColor} />
        <Circle cx={lowPoint.x} cy={lowPoint.y} r={4.6} fill={lineColor} />

        <Line
          x1={highPoint.x}
          y1={highPoint.y}
          x2={highBoxX}
          y2={highBoxY + labelHeight / 2}
          stroke={lineColor}
          strokeOpacity={0.7}
          strokeWidth={1.2}
        />
        <Line
          x1={lowPoint.x}
          y1={lowPoint.y}
          x2={lowBoxX}
          y2={lowBoxY + labelHeight / 2}
          stroke={lineColor}
          strokeOpacity={0.7}
          strokeWidth={1.2}
        />

        <Rect
          x={highBoxX}
          y={highBoxY}
          width={highLabelWidth}
          height={labelHeight}
          rx={6}
          fill={surface}
          stroke={border}
          strokeOpacity={0.9}
        />
        <SvgText
          x={highBoxX + highLabelWidth / 2}
          y={highBoxY + 12.5}
          fill={text}
          fontSize="11"
          fontWeight="700"
          textAnchor="middle"
        >
          {highLabel}
        </SvgText>

        <Rect
          x={lowBoxX}
          y={lowBoxY}
          width={lowLabelWidth}
          height={labelHeight}
          rx={6}
          fill={surface}
          stroke={border}
          strokeOpacity={0.9}
        />
        <SvgText
          x={lowBoxX + lowLabelWidth / 2}
          y={lowBoxY + 12.5}
          fill={text}
          fontSize="11"
          fontWeight="700"
          textAnchor="middle"
        >
          {lowLabel}
        </SvgText>
      </Svg>
    </View>
  );
}

function money(value?: number) {
  return value && Number.isFinite(value) ? `$${value.toFixed(2)}` : "--";
}

export default function StockDetailScreen() {
  const router = useRouter();
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const sym = (symbol ?? "AAPL").toUpperCase();

  const { colors, resolvedScheme } = useContext(ThemeContext);
  const { watchlist, toggleSymbol } = useContext(WatchlistContext);
  const isInWatchlist = useMemo(() => watchlist.includes(sym), [watchlist, sym]);

  const [selectedRange, setSelectedRange] = useState<TimeRange>("1W");
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [history, setHistory] = useState<TimePoint[]>([]);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState("");

  const subtleSurface =
    resolvedScheme === "dark"
      ? "rgba(255,255,255,0.08)"
      : "rgba(17,24,39,0.06)";
  const segmentActiveBg =
    resolvedScheme === "dark"
      ? "rgba(255,255,255,0.14)"
      : "rgba(17,24,39,0.10)";

  async function loadQuote(forceRefresh = false) {
    setLoadingQuote(true);
    try {
      const nextQuote = await fetchQuote(sym, forceRefresh);
      setQuote(nextQuote);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load latest price."
      );
    } finally {
      setLoadingQuote(false);
    }
  }

  async function loadHistory(range: TimeRange, forceRefresh = false) {
    setLoadingHistory(true);
    try {
      const nextHistory = await fetchTimeSeries(sym, range, forceRefresh);
      setHistory(nextHistory);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load chart data."
      );
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleManualRefresh() {
    setError("");
    await Promise.all([loadQuote(true), loadHistory(selectedRange, true)]);
  }

  useEffect(() => {
    setError("");
    loadQuote(false);
  }, [sym]);

  useEffect(() => {
    setError("");
    loadHistory(selectedRange);
  }, [sym, selectedRange]);

  const currentPrice = quote?.close ?? 0;
  const change = quote?.change ?? 0;
  const pct = quote?.percentChange ?? 0;
  const up = pct >= 0;
  const pointsToShow =
    history.length > 0 ? history : [{ datetime: "0", close: 0 }];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.symbol, { color: colors.text }]}>{sym}</Text>
          <Text style={[styles.companyName, { color: colors.subtext }]}>
            {quote?.name || "Stock detail"}
          </Text>
        </View>
        <Pressable
          style={[
            styles.refreshBtn,
            { borderColor: colors.border, backgroundColor: colors.card },
          ]}
          onPress={handleManualRefresh}
        >
          <Text style={[styles.refreshText, { color: colors.text }]}>
            {loadingQuote ? "Loading" : "Refresh"}
          </Text>
        </Pressable>
      </View>

      {!hasConfiguredApiKey() && (
        <View
          style={[
            styles.notice,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.noticeText, { color: colors.subtext }]}>
            Set your Twelve Data API key to replace demo fallback data.
          </Text>
        </View>
      )}

      {!!error && (
        <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
      )}

      <View style={styles.priceSection}>
        <Text style={[styles.currentPrice, { color: colors.text }]}>
          {money(currentPrice)}
        </Text>
        <View style={styles.changeContainer}>
          <Text
            style={[
              styles.changeText,
              { color: up ? "#34c759" : colors.danger },
            ]}
          >
            {change >= 0 ? "+" : ""}
            {change.toFixed(2)}
          </Text>
          <Text
            style={[
              styles.changeText,
              { color: up ? "#34c759" : colors.danger },
            ]}
          >
            ({pct >= 0 ? "+" : ""}
            {pct.toFixed(2)}%)
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.segmentedControl,
          { backgroundColor: subtleSurface, borderColor: colors.border },
        ]}
      >
        {timeRanges.map((range) => (
          <Pressable
            key={range}
            style={[
              styles.segmentButton,
              selectedRange === range && { backgroundColor: segmentActiveBg },
            ]}
            onPress={() => setSelectedRange(range)}
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color:
                    selectedRange === range ? colors.text : colors.subtext,
                },
              ]}
            >
              {range}
            </Text>
          </Pressable>
        ))}
      </View>

      <ChartLine
        points={pointsToShow}
        border={colors.border}
        tint={colors.tint}
        text={colors.text}
        subtext={colors.subtext}
        surface={colors.card}
      />

      {loadingHistory && (
        <Text style={[styles.chartLoadingText, { color: colors.subtext }]}>
          Loading chart...
        </Text>
      )}

      <View
        style={[
          styles.statsCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.statsTitle, { color: colors.text }]}>
          Key Statistics
        </Text>
        <View style={styles.statsGrid}>
          <StatItem
            label="Open"
            value={money(quote?.open)}
            subtext={colors.subtext}
            text={colors.text}
          />
          <StatItem
            label="High"
            value={money(quote?.high)}
            subtext={colors.subtext}
            text={colors.text}
          />
          <StatItem
            label="Low"
            value={money(quote?.low)}
            subtext={colors.subtext}
            text={colors.text}
          />
          <StatItem
            label="Prev Close"
            value={money(quote?.previousClose)}
            subtext={colors.subtext}
            text={colors.text}
          />
          <StatItem
            label="Volume"
            value={formatVolume(quote?.volume)}
            subtext={colors.subtext}
            text={colors.text}
          />
          <StatItem
            label="Points"
            value={`${history.length}`}
            subtext={colors.subtext}
            text={colors.text}
          />
        </View>
      </View>

      <View style={styles.actionsContainer}>
        <Pressable
          style={[styles.primaryButton, { backgroundColor: colors.tint }]}
          onPress={() =>
            router.push(`/alert/create?symbol=${encodeURIComponent(sym)}`)
          }
        >
          <Text style={styles.primaryButtonText}>Create Alert</Text>
        </Pressable>

        <Pressable
          style={[
            styles.secondaryButton,
            { backgroundColor: subtleSurface, borderColor: colors.border },
          ]}
          onPress={() => toggleSymbol(sym)}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
            {isInWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.subtext }]}>Back</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  symbol: { fontSize: 32, fontWeight: "800" },
  companyName: { fontSize: 14, marginTop: 4 },
  refreshBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  refreshText: { fontSize: 13, fontWeight: "700" },
  notice: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 14 },
  noticeText: { fontSize: 12, lineHeight: 18 },
  error: { marginTop: 12, fontSize: 13, fontWeight: "600" },
  priceSection: { marginTop: 18 },
  currentPrice: { fontSize: 40, fontWeight: "800" },
  changeContainer: { flexDirection: "row", gap: 8, marginTop: 8 },
  changeText: { fontSize: 16, fontWeight: "700" },
  segmentedControl: {
    marginTop: 22,
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
  },
  segmentText: { fontSize: 13, fontWeight: "700" },
  chartBox: {
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 220,
    overflow: "hidden",
  },
  chartLoadingText: {
    marginTop: 8,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "600",
  },
  statsCard: { marginTop: 18, borderWidth: 1, borderRadius: 18, padding: 16 },
  statsTitle: { fontSize: 18, fontWeight: "800", marginBottom: 14 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 16 },
  statItem: { width: "50%" },
  statLabel: { fontSize: 12, marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: "700" },
  actionsContainer: { marginTop: 22, gap: 12 },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  secondaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  secondaryButtonText: { fontSize: 15, fontWeight: "700" },
  backText: { textAlign: "center", fontSize: 14 },
});
