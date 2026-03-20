import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import { SettingsContext, ThemeContext } from "../_layout";

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

const API_BASE = "http://192.168.1.226:8000";
const NEWS_CACHE_KEY = "stockclock_news_cache_v1";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sentimentPosition(sentiment: SentimentLabel, score?: number) {
  const confidence = typeof score === "number" ? clamp(score, 0, 1) : 0.55;

  if (sentiment === "Negative") return 8 + (1 - confidence) * 24;
  if (sentiment === "Positive") return 92 - (1 - confidence) * 24;
  return 50;
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

function formatCacheTime(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isNewsItemArray(value: unknown): value is NewsItem[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof (item as NewsItem).id === "string" &&
        typeof (item as NewsItem).title === "string" &&
        typeof (item as NewsItem).source === "string" &&
        typeof (item as NewsItem).link === "string"
    )
  );
}

export default function NewsScreen() {
  const { colors } = useContext(ThemeContext);
  const { settings } = useContext(SettingsContext);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [usingCachedNews, setUsingCachedNews] = useState(false);
  const [cachedAt, setCachedAt] = useState("");

  const loadNews = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setError("");
      setUsingCachedNews(false);
      setCachedAt("");

      const res = await fetch(`${API_BASE}/news`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const nextNews = Array.isArray(data) ? data : [];
      setNews(nextNews);

      await AsyncStorage.setItem(
        NEWS_CACHE_KEY,
        JSON.stringify({
          savedAt: new Date().toISOString(),
          items: nextNews,
        })
      );
    } catch (err) {
      console.error("Failed to load news:", err);

      if (settings.useCachedDataWhenOffline) {
        try {
          const cachedRaw = await AsyncStorage.getItem(NEWS_CACHE_KEY);
          if (cachedRaw) {
            const parsed = JSON.parse(cachedRaw) as { savedAt?: string; items?: unknown };
            if (isNewsItemArray(parsed?.items) && parsed.items.length > 0) {
              setNews(parsed.items);
              setUsingCachedNews(true);
              setCachedAt(parsed.savedAt ?? "");
              setError("");
              return;
            }
          }
        } catch (cacheErr) {
          console.error("Failed to read cached news:", cacheErr);
        }
      }

      setError("Unable to load news");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNews();
  }, []);

  const grouped = useMemo(() => {
    const map: Record<string, NewsItem[]> = {};
    for (const item of news) {
      const key = item.ticker || "General";
      if (!map[key]) map[key] = [];
      if (map[key].length < settings.newsItemsPerStock) {
        map[key].push(item);
      }
    }
    return Object.entries(map);
  }, [news, settings.newsItemsPerStock]);

  const openLink = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        showTitle: true,
        enableBarCollapsing: true,
      });
    } catch (err) {
      console.error("Failed to open URL:", err);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => loadNews(true)} tintColor={colors.text} />
      }
    >
      <Text style={[styles.pageTitle, { color: colors.text }]}>News Headlines</Text>

      {usingCachedNews ? (
        <View style={[styles.cacheBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cacheBannerTitle, { color: colors.text }]}>Showing saved news</Text>
          <Text style={[styles.cacheBannerText, { color: colors.subtext }]}>
            {cachedAt ? `Last successful update: ${formatCacheTime(cachedAt)}` : "Live request failed"}
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.text} />
          <Text style={[styles.stateText, { color: colors.subtext }]}>Loading latest headlines...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
          <Text style={[styles.stateText, { color: colors.subtext }]}>Pull down to refresh</Text>
        </View>
      ) : news.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={[styles.stateText, { color: colors.subtext }]}>No news available</Text>
        </View>
      ) : (
        grouped.map(([ticker, items]) => (
          <View key={ticker} style={styles.groupWrap}>
            <Text style={[styles.groupTitle, { color: colors.text }]}>{ticker}</Text>
            {items.map((item) => {
              const markerLeft = `${sentimentPosition(item.sentiment, item.score)}%`;

              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.85}
                  onPress={() => openLink(item.link)}
                  style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
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
            })}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingTop: 56, paddingBottom: 34 },
  pageTitle: { fontSize: 34, fontWeight: "700", letterSpacing: -0.5, marginBottom: 10 },
  cacheBanner: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 14 },
  cacheBannerTitle: { fontSize: 14, fontWeight: "700" },
  cacheBannerText: { marginTop: 4, fontSize: 12 },
  centerState: { paddingVertical: 50, alignItems: "center", justifyContent: "center" },
  stateText: { marginTop: 10, fontSize: 14 },
  errorText: { fontSize: 16, fontWeight: "700" },
  groupWrap: { marginTop: 10, gap: 10 },
  groupTitle: { fontSize: 18, fontWeight: "800", marginTop: 8 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16 },
  headline: { fontSize: 18, fontWeight: "700", lineHeight: 24 },
  meta: { fontSize: 13, marginTop: 6 },
  sentimentTitle: { marginTop: 14, fontSize: 13, fontWeight: "700" },
  scaleRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  sideLabel: { width: 42, fontSize: 12, fontWeight: "600" },
  scaleWrap: { flex: 1, position: "relative", justifyContent: "center" },
  gradientRow: { height: 8, borderRadius: 999, overflow: "hidden", flexDirection: "row" },
  seg: { flex: 1 },
  marker: {
    position: "absolute",
    top: -4,
    marginLeft: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#fff",
    borderWidth: 2,
  },
});
