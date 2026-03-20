import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, {
  Circle,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import {
  fetchQuote,
  fetchTimeSeries,
  formatVolume,
  hasConfiguredApiKey,
  type QuoteData,
  type TimePoint,
} from "../../services/marketData";
import { SettingsContext, ThemeContext, WatchlistContext, type DefaultChartRange } from "../_layout";

const API_BASE = "http://192.168.1.226:8000";

type TimeRange =
  | "1H"
  | "4H"
  | "6H"
  | "8H"
  | "12H"
  | "1D"
  | "5D"
  | "1W"
  | "2W"
  | "1M"
  | "3M"
  | "6M"
  | "1Y";

type RangeGroupKey = "H" | "D" | "W" | "M";
type SentimentLabel = "Positive" | "Negative" | "Neutral";

type NewsItem = {
  id: string;
  ticker: string;
  title: string;
  source: string;
  sentiment: SentimentLabel;
  score?: number;
  link: string;
  time?: string;
};

type PerformanceMap = Partial<Record<"1D" | "1W" | "1M" | "1Y", number | null>>;

type CacheEnvelope<T> = {
  data: T;
  savedAt: string;
};

const rangeGroups: Array<{ key: RangeGroupKey; label: string; items: TimeRange[] }> = [
  { key: "H", label: "H", items: ["1H", "4H", "6H", "8H", "12H"] },
  { key: "D", label: "D", items: ["1D", "5D"] },
  { key: "W", label: "W", items: ["1W", "2W"] },
  { key: "M", label: "M", items: ["1M", "3M", "6M", "1Y"] },
];

function groupForRange(range: TimeRange | DefaultChartRange): RangeGroupKey {
  const found = rangeGroups.find((group) => group.items.includes(range as TimeRange));
  return found?.key ?? "D";
}

function quoteCacheKey(symbol: string) {
  return `stockclock_quote_cache_${symbol}`;
}

function chartCacheKey(symbol: string, range: TimeRange) {
  return `stockclock_chart_cache_${symbol}_${range}`;
}

function newsCacheKey(symbol: string) {
  return `stockclock_news_cache_${symbol}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatTime(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSavedTime(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortDateLabel(value: string, range: TimeRange) {
  if (!value) return "";
  const parsed = new Date(value.replace(" ", "T"));

  if (!Number.isNaN(parsed.getTime())) {
    if (range === "1H" || range === "4H" || range === "6H" || range === "8H" || range === "12H" || range === "1D") {
      return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    if (range === "5D" || range === "1W" || range === "2W") {
      return parsed.toLocaleDateString([], { month: "short", day: "numeric" });
    }
    return parsed.toLocaleDateString([], { month: "short", year: "2-digit" });
  }

  const dayPart = value.slice(0, 10);
  const timePart = value.length >= 16 ? value.slice(11, 16) : "";
  return timePart || dayPart;
}

function money(value?: number) {
  return typeof value === "number" && Number.isFinite(value) ? `$${value.toFixed(2)}` : "--";
}

function sentimentPosition(sentiment: SentimentLabel, score?: number) {
  const confidence = typeof score === "number" ? clamp(score, 0, 1) : 0.55;

  if (sentiment === "Negative") return 8 + (1 - confidence) * 24;
  if (sentiment === "Positive") return 92 - (1 - confidence) * 24;
  return 50;
}

function normalizeNewsItem(raw: any, index: number): NewsItem | null {
  const title = raw?.title ?? raw?.headline ?? raw?.name;
  const link = raw?.link ?? raw?.url ?? raw?.article_url;
  const ticker = String(raw?.ticker ?? raw?.symbol ?? "").toUpperCase();
  const sentimentRaw = String(raw?.sentiment ?? "Neutral").toLowerCase();

  let sentiment: SentimentLabel = "Neutral";
  if (sentimentRaw.includes("pos")) sentiment = "Positive";
  else if (sentimentRaw.includes("neg")) sentiment = "Negative";

  const scoreValue =
    typeof raw?.score === "number"
      ? raw.score
      : typeof raw?.confidence === "number"
      ? raw.confidence
      : undefined;

  if (!title || !link) return null;

  return {
    id: String(raw?.id ?? `${ticker || "news"}-${index}`),
    ticker,
    title: String(title),
    source: String(raw?.source ?? raw?.publisher ?? "News"),
    sentiment,
    score: typeof scoreValue === "number" ? Math.abs(scoreValue) : undefined,
    link: String(link),
    time: raw?.time ?? raw?.datetime ?? raw?.published_at,
  };
}

function computeRangePerformance(points: TimePoint[]) {
  if (!points.length) return null;
  const first = points[0]?.close;
  const last = points[points.length - 1]?.close;
  if (!Number.isFinite(first) || !Number.isFinite(last) || !first) return null;
  return ((last - first) / first) * 100;
}

async function saveCache<T>(key: string, data: T) {
  const payload: CacheEnvelope<T> = { data, savedAt: new Date().toISOString() };
  try {
    await AsyncStorage.setItem(key, JSON.stringify(payload));
  } catch {}
}

async function readCache<T>(key: string): Promise<CacheEnvelope<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEnvelope<T>;
  } catch {
    return null;
  }
}

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

function PerformancePill({
  label,
  value,
  colors,
}: {
  label: string;
  value: number | null | undefined;
  colors: { text: string; subtext: string; card: string; border: string; danger: string };
}) {
  const positive = (value ?? 0) >= 0;
  return (
    <View style={[styles.performancePill, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.performanceLabel, { color: colors.subtext }]}>{label}</Text>
      <Text
        style={[
          styles.performanceValue,
          { color: value == null ? colors.text : positive ? "#34c759" : colors.danger },
        ]}
      >
        {value == null ? "--" : `${positive ? "+" : ""}${value.toFixed(2)}%`}
      </Text>
    </View>
  );
}

function ChartLine({
  points,
  range,
  border,
  tint,
  text,
  subtext,
  surface,
}: {
  points: TimePoint[];
  range: TimeRange;
  border: string;
  tint: string;
  text: string;
  subtext: string;
  surface: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    setActiveIndex(points.length ? points.length - 1 : null);
  }, [points, range]);

  const width = 340;
  const height = 244;
  const leftPad = 52;
  const rightPad = 14;
  const topPad = 20;
  const bottomPad = 40;
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

  const activePoint =
    activeIndex != null && plotted[activeIndex] ? plotted[activeIndex] : null;
  const activePrice = activePoint ? `$${activePoint.close.toFixed(2)}` : "";
  const activeTime = activePoint ? formatTime(activePoint.datetime) || activePoint.datetime : "";
  const activeWidth = Math.max(96, activePrice.length * 8.2, activeTime.length * 5.2);
  const activeHeight = 38;
  const activeBoxX = activePoint
    ? clamp(activePoint.x - activeWidth / 2, leftPad + 2, width - rightPad - activeWidth - 2)
    : 0;
  const activeBoxY = activePoint
    ? clamp(activePoint.y - 56, 6, height - activeHeight - 12)
    : 0;

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
              <SvgText x={8} y={y + 4} fill={subtext} fontSize="10" fontWeight="600">
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
                {shortDateLabel(point.datetime, range)}
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

        {plotted.map((point, index) => (
          <React.Fragment key={point.datetime + index}>
            <Circle cx={point.x} cy={point.y} r={2.6} fill={lineColor} />
            <Circle
              cx={point.x}
              cy={point.y}
              r={12}
              fill="transparent"
              onPress={() => setActiveIndex(index)}
            />
          </React.Fragment>
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

        {activePoint && (
          <>
            <Line
              x1={activePoint.x}
              y1={topPad}
              x2={activePoint.x}
              y2={topPad + innerHeight}
              stroke={lineColor}
              strokeOpacity={0.28}
              strokeDasharray="4 4"
            />
            <Circle cx={activePoint.x} cy={activePoint.y} r={6.2} fill={lineColor} />
            <Circle cx={activePoint.x} cy={activePoint.y} r={3.2} fill={surface} />
            <Rect
              x={activeBoxX}
              y={activeBoxY}
              width={activeWidth}
              height={activeHeight}
              rx={10}
              fill={surface}
              stroke={border}
              strokeOpacity={0.95}
            />
            <SvgText x={activeBoxX + activeWidth / 2} y={activeBoxY + 14} fill={text} fontSize="11" fontWeight="700" textAnchor="middle">
              {activePrice}
            </SvgText>
            <SvgText x={activeBoxX + activeWidth / 2} y={activeBoxY + 29} fill={subtext} fontSize="10" fontWeight="600" textAnchor="middle">
              {activeTime}
            </SvgText>
          </>
        )}
      </Svg>
    </View>
  );
}

export default function StockDetailScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const sym = (symbol ?? "AAPL").toUpperCase();

  const { colors, resolvedScheme } = useContext(ThemeContext);
  const { watchlist, toggleSymbol } = useContext(WatchlistContext);
  const { settings } = useContext(SettingsContext);
  const isInWatchlist = useMemo(() => watchlist.includes(sym), [watchlist, sym]);

  const [selectedGroup, setSelectedGroup] = useState<RangeGroupKey>("D");
  const [selectedRange, setSelectedRange] = useState<TimeRange>(settings.defaultChartRange);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [history, setHistory] = useState<TimePoint[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [performance, setPerformance] = useState<PerformanceMap>({});
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingNews, setLoadingNews] = useState(false);
  const [infoMessages, setInfoMessages] = useState<string[]>([]);
  const [error, setError] = useState("");

  const subtleSurface =
    resolvedScheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(17,24,39,0.06)";
  const segmentActiveBg =
    resolvedScheme === "dark" ? "rgba(255,255,255,0.14)" : "rgba(17,24,39,0.10)";

  const currentRangeOptions =
    rangeGroups.find((group) => group.key === selectedGroup)?.items ?? rangeGroups[1].items;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: sym,
      headerBackTitle: "",
    });
  }, [navigation, sym]);

  async function loadQuote(forceRefresh = false) {
    setLoadingQuote(true);
    try {
      const nextQuote = await fetchQuote(sym, forceRefresh);
      setQuote(nextQuote);
      saveCache(quoteCacheKey(sym), nextQuote);
    } catch (err) {
      const cached = settings.useCachedDataWhenOffline ? await readCache<QuoteData>(quoteCacheKey(sym)) : null;
      if (cached?.data) {
        setQuote(cached.data);
        setInfoMessages((prev) => [
          ...prev,
          `Showing saved price data from ${formatSavedTime(cached.savedAt)}.`,
        ]);
      } else {
        setError(err instanceof Error ? err.message : "Unable to refresh price right now.");
      }
    } finally {
      setLoadingQuote(false);
    }
  }

  async function loadHistory(range: TimeRange, forceRefresh = false) {
    setLoadingHistory(true);
    try {
      const nextHistory = await fetchTimeSeries(sym, range, forceRefresh);
      setHistory(nextHistory);
      saveCache(chartCacheKey(sym, range), nextHistory);
    } catch (err) {
      const cached = settings.useCachedDataWhenOffline ? await readCache<TimePoint[]>(chartCacheKey(sym, range)) : null;
      if (cached?.data?.length) {
        setHistory(cached.data);
        setInfoMessages((prev) => [
          ...prev,
          `Showing saved ${range} chart data from ${formatSavedTime(cached.savedAt)}.`,
        ]);
      } else {
        setError(err instanceof Error ? err.message : "Unable to load chart data right now.");
      }
    } finally {
      setLoadingHistory(false);
    }
  }

  async function loadNews(forceRefresh = false) {
    setLoadingNews(true);
    try {
      const res = await fetch(`${API_BASE}/news` + (forceRefresh ? `?t=${Date.now()}` : ""));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data)
        ? data
            .map((item, index) => normalizeNewsItem(item, index))
            .filter((item): item is NewsItem => !!item)
        : [];

      const exact = list.filter((item) => item.ticker === sym);
      const loose = list.filter(
        (item) => item.ticker === "" && item.title.toUpperCase().includes(sym)
      );
      const selected = (exact.length ? exact : loose).slice(0, settings.newsItemsPerStock);
      setNews(selected);
      if (selected.length) saveCache(newsCacheKey(sym), selected);
    } catch {
      const cached = settings.useCachedDataWhenOffline ? await readCache<NewsItem[]>(newsCacheKey(sym)) : null;
      if (cached?.data?.length) {
        setNews(cached.data);
        setInfoMessages((prev) => [
          ...prev,
          `Latest news is unavailable, showing saved articles from ${formatSavedTime(cached.savedAt)}.`,
        ]);
      }
    } finally {
      setLoadingNews(false);
    }
  }

  async function loadPerformance() {
    try {
      const ranges: Array<"1D" | "1W" | "1M" | "1Y"> = ["1D", "1W", "1M", "1Y"];
      const results = await Promise.all(
        ranges.map(async (range) => {
          try {
            const points = await fetchTimeSeries(sym, range, false);
            return [range, computeRangePerformance(points)] as const;
          } catch {
            const cached = await readCache<TimePoint[]>(chartCacheKey(sym, range));
            return [range, computeRangePerformance(cached?.data ?? [])] as const;
          }
        })
      );

      const next: PerformanceMap = {};
      for (const [range, value] of results) next[range] = value;
      setPerformance(next);
    } catch {}
  }

  async function handleManualRefresh() {
    setError("");
    setInfoMessages([]);
    await Promise.all([
      loadQuote(true),
      loadHistory(selectedRange, true),
      loadNews(true),
      loadPerformance(),
    ]);
  }

  useEffect(() => {
    const initialRange = settings.defaultChartRange;
    setError("");
    setInfoMessages([]);
    setSelectedGroup(groupForRange(initialRange));
    setSelectedRange(initialRange);
    loadQuote(false);
    loadNews(false);
    loadPerformance();
  }, [sym, settings.defaultChartRange]);

  useEffect(() => {
    if (!currentRangeOptions.includes(selectedRange)) {
      setSelectedRange(currentRangeOptions[0]);
    }
  }, [currentRangeOptions, selectedRange]);

  useEffect(() => {
    setError("");
    setInfoMessages([]);
    loadHistory(selectedRange);
  }, [sym, selectedRange]);

  useEffect(() => {
    if (!settings.autoRefreshSeconds) return;

    const timer = setInterval(() => {
      loadQuote(false);
      loadHistory(selectedRange, false);
    }, settings.autoRefreshSeconds * 1000);

    return () => clearInterval(timer);
  }, [settings.autoRefreshSeconds, sym, selectedRange]);

  const currentPrice = quote?.close ?? 0;
  const change = quote?.change ?? 0;
  const pct = quote?.percentChange ?? 0;
  const up = pct >= 0;
  const pointsToShow = history.length > 0 ? history : [{ datetime: "0", close: 0 }];
  const historyHigh = history.length ? Math.max(...history.map((item) => item.close)) : null;
  const historyLow = history.length ? Math.min(...history.map((item) => item.close)) : null;
  const rangeReturn = computeRangePerformance(history);
  const subtitle = quote?.exchange ? `${quote.exchange} · ${sym}` : sym;
  const uniqueInfoMessages = Array.from(new Set(infoMessages));

  const openLink = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {}
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.companyHero, { color: colors.text }]} numberOfLines={1}>
            {quote?.name || sym}
          </Text>
          <Text style={[styles.symbolMeta, { color: colors.subtext }]}>{subtitle}</Text>
        </View>
        <Pressable
          style={[styles.refreshBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
          onPress={handleManualRefresh}
        >
          <Text style={[styles.refreshText, { color: colors.text }]}> 
            {loadingQuote || loadingHistory || loadingNews ? "Loading" : "Refresh"}
          </Text>
        </Pressable>
      </View>

      {!hasConfiguredApiKey() && (
        <View style={[styles.notice, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <Text style={[styles.noticeText, { color: colors.subtext }]}>Set your Twelve Data API key to replace demo fallback data.</Text>
        </View>
      )}

      <View style={styles.priceSection}>
        <Text style={[styles.currentPrice, { color: colors.text }]}>{money(currentPrice)}</Text>
        <View style={styles.changeContainer}>
          <Text style={[styles.changeText, { color: up ? "#34c759" : colors.danger }]}>
            {change >= 0 ? "+" : ""}
            {change.toFixed(2)}
          </Text>
          <Text style={[styles.changeText, { color: up ? "#34c759" : colors.danger }]}>
            ({pct >= 0 ? "+" : ""}
            {pct.toFixed(2)}%)
          </Text>
        </View>
      </View>

      {!!error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

      {uniqueInfoMessages.length > 0 && (
        <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          {uniqueInfoMessages.map((message) => (
            <Text key={message} style={[styles.statusText, { color: colors.subtext }]}>
              {message}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.performanceRow}>
        <PerformancePill label="1D" value={performance["1D"]} colors={colors} />
        <PerformancePill label="1W" value={performance["1W"]} colors={colors} />
        <PerformancePill label="1M" value={performance["1M"]} colors={colors} />
        <PerformancePill label="1Y" value={performance["1Y"]} colors={colors} />
      </View>

      <View style={styles.rangeSection}>
        <View
          style={[
            styles.segmentedControl,
            { backgroundColor: subtleSurface, borderColor: colors.border },
          ]}
        >
          {rangeGroups.map((group) => (
            <Pressable
              key={group.key}
              style={[
                styles.segmentButton,
                selectedGroup === group.key && { backgroundColor: segmentActiveBg },
              ]}
              onPress={() => {
                setSelectedGroup(group.key);
                setSelectedRange(group.items[0]);
              }}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: selectedGroup === group.key ? colors.text : colors.subtext },
                ]}
              >
                {group.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.rangeChipRow}>
          {currentRangeOptions.map((range) => {
            const active = selectedRange === range;
            return (
              <Pressable
                key={range}
                style={[
                  styles.rangeChip,
                  {
                    borderColor: active ? colors.tint : colors.border,
                    backgroundColor: active ? colors.tint : colors.card,
                  },
                ]}
                onPress={() => setSelectedRange(range)}
              >
                <Text style={[styles.rangeChipText, { color: active ? "#fff" : colors.text }]}>
                  {range}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ChartLine
        points={pointsToShow}
        range={selectedRange}
        border={colors.border}
        tint={colors.tint}
        text={colors.text}
        subtext={colors.subtext}
        surface={colors.card}
      />

      <View style={styles.chartSummaryRow}>
        <Text style={[styles.chartSummaryText, { color: colors.subtext }]}> 
          {selectedRange} range: {money(historyLow ?? undefined)} - {money(historyHigh ?? undefined)}
        </Text>
        <Text
          style={[
            styles.chartSummaryText,
            { color: rangeReturn == null ? colors.subtext : rangeReturn >= 0 ? "#34c759" : colors.danger },
          ]}
        >
          {rangeReturn == null ? "--" : `${rangeReturn >= 0 ? "+" : ""}${rangeReturn.toFixed(2)}%`}
        </Text>
      </View>

      <Text style={[styles.chartHint, { color: colors.subtext }]}>Tap a point on the line to see the exact price and time.</Text>

      {loadingHistory && (
        <Text style={[styles.chartLoadingText, { color: colors.subtext }]}>Loading chart...</Text>
      )}

      <View style={[styles.newsCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent News</Text>
          {loadingNews && <ActivityIndicator size="small" color={colors.subtext} />}
        </View>

        {news.length === 0 ? (
          <Text style={[styles.emptyStateText, { color: colors.subtext }]}>No recent articles available for {sym}.</Text>
        ) : (
          news.map((item) => {
            const markerLeft = `${sentimentPosition(item.sentiment, item.score)}%`;

            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.82}
                onPress={() => openLink(item.link)}
                style={[styles.article, { borderBottomColor: colors.border }]}
              >
                <Text style={[styles.headline, { color: colors.text }]}>{item.title}</Text>
                <Text style={[styles.meta, { color: colors.subtext }]}> 
                  {item.source}
                  {item.time ? ` • ${formatTime(item.time)}` : ""}
                </Text>
                <Text style={[styles.sentimentTitle, { color: colors.text }]}>Market sentimentality</Text>
                <View style={styles.scaleRow}>
                  <Text style={[styles.sideLabel, { color: colors.subtext }]}>Short</Text>
                  <View style={styles.scaleWrap}>
                    <View style={styles.gradientRow}>
                      <View style={[styles.seg, { backgroundColor: "#ff2a2a" }]} />
                      <View style={[styles.seg, { backgroundColor: "#ff5a1f" }]} />
                      <View style={[styles.seg, { backgroundColor: "#ff8f1a" }]} />
                      <View style={[styles.seg, { backgroundColor: "#f0c000" }]} />
                      <View style={[styles.seg, { backgroundColor: "#d4df00" }]} />
                      <View style={[styles.seg, { backgroundColor: "#8fbe12" }]} />
                      <View style={[styles.seg, { backgroundColor: "#169c17" }]} />
                    </View>
                    <View style={[styles.marker, { left: markerLeft, borderColor: colors.card }]} />
                  </View>
                  <Text style={[styles.sideLabel, { color: colors.subtext }]}>Long</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
        <Text style={[styles.statsTitle, { color: colors.text }]}>Key Statistics</Text>
        <View style={styles.statsGrid}>
          <StatItem label="Open" value={money(quote?.open)} subtext={colors.subtext} text={colors.text} />
          <StatItem label="High" value={money(quote?.high)} subtext={colors.subtext} text={colors.text} />
          <StatItem label="Low" value={money(quote?.low)} subtext={colors.subtext} text={colors.text} />
          <StatItem label="Prev Close" value={money(quote?.previousClose)} subtext={colors.subtext} text={colors.text} />
          <StatItem label="Volume" value={formatVolume(quote?.volume)} subtext={colors.subtext} text={colors.text} />
          <StatItem
            label="Day Range"
            value={quote?.low != null && quote?.high != null ? `${money(quote.low)} - ${money(quote.high)}` : "--"}
            subtext={colors.subtext}
            text={colors.text}
          />
        </View>
      </View>

      <View style={styles.actionsContainer}>
        <Pressable
          style={[styles.primaryButton, { backgroundColor: colors.tint }]}
          onPress={() => router.push(`/alert/create?symbol=${encodeURIComponent(sym)}`)}
        >
          <Text style={styles.primaryButtonText}>Create Alert</Text>
        </Pressable>

        <Pressable
          style={[styles.secondaryButton, { backgroundColor: subtleSurface, borderColor: colors.border }]}
          onPress={() => toggleSymbol(sym)}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
            {isInWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: 20, paddingTop: 28, paddingBottom: 40 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  headerTextWrap: { flex: 1, paddingRight: 8 },
  companyHero: { fontSize: 30, fontWeight: "800" },
  symbolMeta: { fontSize: 14, marginTop: 6 },
  refreshBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  refreshText: { fontSize: 13, fontWeight: "700" },
  notice: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 14 },
  noticeText: { fontSize: 12, lineHeight: 18 },
  priceSection: { marginTop: 18 },
  currentPrice: { fontSize: 42, fontWeight: "800" },
  changeContainer: { flexDirection: "row", gap: 8, marginTop: 8 },
  changeText: { fontSize: 16, fontWeight: "700" },
  error: { marginTop: 12, fontSize: 13, fontWeight: "600" },
  statusCard: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  statusText: { fontSize: 12, lineHeight: 18 },
  performanceRow: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  performancePill: {
    width: "47%",
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  performanceLabel: { fontSize: 12, marginBottom: 6, fontWeight: "700" },
  performanceValue: { fontSize: 18, fontWeight: "800" },
  rangeSection: { marginTop: 22, gap: 10 },
  segmentedControl: {
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
  rangeChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  rangeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  rangeChipText: { fontSize: 13, fontWeight: "700" },
  chartBox: {
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 220,
    overflow: "hidden",
  },
  chartSummaryRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  chartSummaryText: { fontSize: 12, fontWeight: "600" },
  chartHint: { marginTop: 8, fontSize: 12, lineHeight: 18 },
  chartLoadingText: {
    marginTop: 8,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "600",
  },
  newsCard: { marginTop: 18, borderWidth: 1, borderRadius: 18, padding: 16 },
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 20, fontWeight: "800" },
  emptyStateText: { fontSize: 14, marginTop: 10, lineHeight: 20 },
  article: {
    paddingTop: 14,
    paddingBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headline: { fontSize: 18, lineHeight: 26, fontWeight: "800" },
  meta: { marginTop: 6, fontSize: 13 },
  sentimentTitle: { marginTop: 14, marginBottom: 14, fontSize: 15, fontWeight: "700" },
  scaleRow: { flexDirection: "row", alignItems: "center" },
  sideLabel: { width: 44, fontSize: 13 },
  scaleWrap: { flex: 1, height: 18, justifyContent: "center", marginHorizontal: 10 },
  gradientRow: { height: 10, flexDirection: "row", overflow: "hidden" },
  seg: { flex: 1, height: 10 },
  marker: {
    position: "absolute",
    top: -4,
    width: 12,
    height: 26,
    marginLeft: -6,
    backgroundColor: "#d9d9d9",
    borderWidth: 2,
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
});
