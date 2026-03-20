import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import { ThemeContext, WatchlistContext } from "../_layout";

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

type FilterMode = "ALL" | string;

const API_BASE = "http://192.168.1.226:8000";
const NEWS_CACHE_KEY = "stockclock_news_cache_v1";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sentimentPosition(sentiment: SentimentLabel, score?: number) {
  const confidence = typeof score === "number" ? clamp(score, 0, 1) : 0.55;

  if (sentiment === "Negative") {
    return 8 + (1 - confidence) * 24;
  }

  if (sentiment === "Positive") {
    return 92 - (1 - confidence) * 24;
  }

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

function normalizeTicker(value?: string) {
  return (value || "NEWS").trim().toUpperCase();
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function getArticleTimeValue(item: NewsItem) {
  if (!item.time) return 0;
  const ms = new Date(item.time).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

export default function NewsScreen() {
  const { colors } = useContext(ThemeContext);
  const { watchlist } = useContext(WatchlistContext);

  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [usingCachedNews, setUsingCachedNews] = useState(false);
  const [cachedAt, setCachedAt] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterMode>("ALL");

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

      setError("Unable to load news");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNews();
  }, []);

  const watchlistTickers = useMemo(() => {
    return Array.from(new Set(watchlist.map((item) => normalizeTicker(item)))).sort();
  }, [watchlist]);

  useEffect(() => {
    if (activeFilter === "ALL") return;
    if (!watchlistTickers.includes(activeFilter)) {
      setActiveFilter("ALL");
    }
  }, [activeFilter, watchlistTickers]);

  const filteredNews = useMemo(() => {
    const keyword = normalizeSearch(searchQuery);

    return [...news]
      .filter((item) => {
        const ticker = normalizeTicker(item.ticker);

        if (activeFilter !== "ALL" && ticker !== activeFilter) {
          return false;
        }

        if (!keyword) return true;

        const haystack = [ticker, item.title, item.source, item.sentiment]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(keyword);
      })
      .sort((a, b) => getArticleTimeValue(b) - getArticleTimeValue(a));
  }, [activeFilter, news, searchQuery]);

  const filterChips = useMemo(() => {
    const chips: { key: FilterMode; label: string }[] = [{ key: "ALL", label: "All" }];
    watchlistTickers.forEach((ticker) => chips.push({ key: ticker, label: ticker }));
    return chips;
  }, [watchlistTickers]);

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

  const emptyTitle = searchQuery.trim()
    ? "No matching news found"
    : activeFilter === "ALL"
    ? "No news available"
    : `No news found for ${activeFilter}`;

  const resultLabel = activeFilter === "ALL" ? "All watchlist news" : `${activeFilter} news`;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadNews(true)}
          tintColor={colors.text}
        />
      }
    >
      <Text style={[styles.pageTitle, { color: colors.text }]}>News Headlines</Text>

      <View
        style={[
          styles.searchBox,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search any keyword"
          placeholderTextColor={colors.subtext}
          style={[styles.searchInput, { color: colors.text }]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={8}>
            <Text style={[styles.clearText, { color: colors.tint }]}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}
      >
        {filterChips.map((chip) => {
          const selected = activeFilter === chip.key;
          return (
            <TouchableOpacity
              key={chip.key}
              activeOpacity={0.85}
              onPress={() => setActiveFilter(chip.key)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: selected ? colors.tint : colors.card,
                  borderColor: selected ? colors.tint : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: selected ? "#ffffff" : colors.text },
                ]}
              >
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.resultsRow}>
        <Text style={[styles.resultsText, { color: colors.subtext }]}>
          {resultLabel} · {filteredNews.length} article{filteredNews.length === 1 ? "" : "s"}
        </Text>
        {(activeFilter !== "ALL" || searchQuery.trim()) && (
          <TouchableOpacity
            onPress={() => {
              setActiveFilter("ALL");
              setSearchQuery("");
            }}
            hitSlop={8}
          >
            <Text style={[styles.resetText, { color: colors.tint }]}>Reset</Text>
          </TouchableOpacity>
        )}
      </View>

      {usingCachedNews ? (
        <View
          style={[
            styles.cacheBanner,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
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
      ) : filteredNews.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={[styles.errorText, { color: colors.text }]}>{emptyTitle}</Text>
          <Text style={[styles.stateText, { color: colors.subtext }]}>Try a different keyword or ticker filter</Text>
        </View>
      ) : (
        <View style={styles.listWrap}>
          {filteredNews.map((item) => renderArticle(item, colors, openLink))}
        </View>
      )}
    </ScrollView>
  );
}

function renderArticle(
  item: NewsItem,
  colors: {
    bg: string;
    text: string;
    subtext: string;
    border: string;
  },
  openLink: (url: string) => void
) {
  const markerLeft = `${sentimentPosition(item.sentiment, item.score)}%`;

  return (
    <TouchableOpacity
      key={item.id}
      activeOpacity={0.82}
      onPress={() => openLink(item.link)}
      style={[styles.article, { borderBottomColor: colors.border }]}
    >
      <View style={styles.articleHeaderRow}>
        <Text style={[styles.articleTicker, { color: colors.subtext }]}>{normalizeTicker(item.ticker)}</Text>
        <Text style={[styles.meta, { color: colors.subtext }]}>
          {item.source}
          {item.time ? ` • ${formatTime(item.time)}` : ""}
        </Text>
      </View>

      <Text style={[styles.headline, { color: colors.text }]}>{item.title}</Text>

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
          <View
            style={[
              styles.marker,
              {
                left: markerLeft,
                borderColor: colors.bg,
              },
            ]}
          />
        </View>

        <Text style={[styles.sideLabel, { color: colors.subtext }]}>Long</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 56,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 18,
  },
  searchBox: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  clearText: {
    fontSize: 13,
    fontWeight: "700",
  },
  filterScroll: {
    marginHorizontal: -2,
    marginBottom: 8,
  },
  filterRow: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "700",
  },
  resultsRow: {
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  resultsText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  resetText: {
    fontSize: 13,
    fontWeight: "700",
  },
  cacheBanner: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 18,
  },
  cacheBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  cacheBannerText: {
    fontSize: 13,
    lineHeight: 18,
  },
  centerState: {
    paddingTop: 60,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  stateText: {
    fontSize: 14,
    textAlign: "center",
  },
  errorText: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  listWrap: {
    marginBottom: 10,
  },
  article: {
    paddingTop: 14,
    paddingBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  articleHeaderRow: {
    marginBottom: 8,
  },
  articleTicker: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  headline: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "800",
  },
  meta: {
    fontSize: 13,
  },
  sentimentTitle: {
    marginTop: 14,
    marginBottom: 14,
    fontSize: 15,
    fontWeight: "700",
  },
  scaleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sideLabel: {
    width: 44,
    fontSize: 13,
  },
  scaleWrap: {
    flex: 1,
    height: 18,
    justifyContent: "center",
    marginHorizontal: 10,
  },
  gradientRow: {
    height: 10,
    flexDirection: "row",
    overflow: "hidden",
  },
  seg: {
    flex: 1,
    height: 10,
  },
  marker: {
    position: "absolute",
    top: -4,
    width: 12,
    height: 26,
    marginLeft: -6,
    backgroundColor: "#d9d9d9",
    borderWidth: 2,
  },
});
