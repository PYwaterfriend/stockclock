import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
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
import { ThemeContext, WatchlistContext } from "../_layout";

type SentimentLabel = "Positive" | "Negative" | "Neutral"; // 新闻情绪标签类型，用于表示该新闻整体偏多、偏空或中性

type NewsItem = { // 单条新闻的数据结构, 包含新闻标题、来源、对应股票、情绪结果、分数、链接和时间等信息
  id: string;
  ticker: string;
  title: string;
  source: string;
  sentiment: SentimentLabel;
  score?: number;
  link: string;
  time?: string;
};

type FilterMode = "ALL" | string; // 筛选模式类型, ALL 表示显示全部新闻，其余值通常是某个股票代码

const API_BASE = "http://192.168.1.226:8000"; // 暂时使用本地地址来获取缓存新闻
const NEWS_CACHE_KEY = "stockclock_news_cache_v1";

function clamp(value: number, min: number, max: number) { // 将数值限制在指定范围内，避免情绪分数越界
  return Math.min(max, Math.max(min, value));
}

// 根据情绪标签和置信分数，计算情绪标记在横向刻度条中的位置，偏空靠左，偏多靠右，中性停留在中间
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

// 将新闻时间格式化为适合列表显示的短时间文本，如果时间无效，则保留原始内容
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

// 将缓存保存时间格式化为提示文本
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

// 检查读取到的缓存数据是否符合新闻数组的基本结构
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

// 统一整理股票代码格式，为空时使用默认占位值，并转换为大写
function normalizeTicker(value?: string) {
  return (value || "NEWS").trim().toUpperCase();
}

// 统一整理搜索关键词，方便后续进行不区分大小写的匹配
function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

// 将新闻时间转换为可排序的时间戳
function getArticleTimeValue(item: NewsItem) {
  if (!item.time) return 0;
  const ms = new Date(item.time).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

// 新闻页面主组件
export default function NewsScreen() {
  const { colors } = useContext(ThemeContext); // 读取当前主题颜色和自选股列表
  const { watchlist } = useContext(WatchlistContext);

  // 页面状态
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [usingCachedNews, setUsingCachedNews] = useState(false);
  const [cachedAt, setCachedAt] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterMode>("ALL");

  // 加载新闻数据
  const loadNews = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); // 根据当前是否为下拉刷新，切换不同的加载状态表现
      else setLoading(true);

      // 每次重新加载前，先清空错误信息和缓存提示状态
      setError(""); 
      setUsingCachedNews(false);
      setCachedAt("");

      // 从后端新闻接口拉取最新新闻数据
      const res = await fetch(`${API_BASE}/news`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const nextNews = Array.isArray(data) ? data : [];
      setNews(nextNews);

      // 请求成功后，将最新新闻和保存时间写入本地缓存，便于接口失败时继续展示旧数据
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
        const cachedRaw = await AsyncStorage.getItem(NEWS_CACHE_KEY); // 当在线请求失败时，尝试读取本地缓存
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
      setLoading(false); // 无论成功或失败，最后都结束加载和刷新状态
      setRefreshing(false);
    }
  };

  // 页面首次挂载时自动请求新闻
  useEffect(() => {
    loadNews();
  }, []);

  // 从自选股列表中整理出去重后的股票代码，作为顶部筛选标签的数据来源
  const watchlistTickers = useMemo(() => {
    return Array.from(new Set(watchlist.map((item) => normalizeTicker(item)))).sort();
  }, [watchlist]);

  // 如果当前选中的股票已经不在自选股列表中，自动重置为ALL，避免出现无效状态
  useEffect(() => {
    if (activeFilter === "ALL") return;
    if (!watchlistTickers.includes(activeFilter)) {
      setActiveFilter("ALL");
    }
  }, [activeFilter, watchlistTickers]);

  const filteredNews = useMemo(() => { // 根据搜索关键词和当前股票筛选条件生成最终展示的新闻列表，按从新到旧排序
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

  const filterChips = useMemo(() => { // 生成顶部筛选按钮数据
    const chips: { key: FilterMode; label: string }[] = [{ key: "ALL", label: "All" }];
    watchlistTickers.forEach((ticker) => chips.push({ key: ticker, label: ticker }));
    return chips;
  }, [watchlistTickers]);

  const openLink = async (url: string) => { // 打开新闻原文链接，使用系统浏览器全屏展示
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

  // 根据当前搜索和筛选状态，生成空结果时显示的提示文本
  const emptyTitle = searchQuery.trim()
    ? "No matching news found"
    : activeFilter === "ALL"
    ? "No news available"
    : `No news found for ${activeFilter}`;

    // 当前结果区域标题
  const resultLabel = activeFilter === "ALL" ? "All watchlist news" : `${activeFilter} news`;

  // 页面主界面
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

      <View // 搜索框区域
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
        {searchQuery ? ( // 输入框有内容时显示清空按钮 
          <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={8}>
            <Text style={[styles.clearText, { color: colors.tint }]}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView // 横向筛选标签区域
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}
      >
        {filterChips.map((chip) => {
          const selected = activeFilter === chip.key;
          return (
            <TouchableOpacity // 单个筛选标签
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
        {(activeFilter !== "ALL" || searchQuery.trim()) && ( // 当存在搜索条件或股票筛选时，显示重置按钮
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

      {usingCachedNews ? ( // 当前显示的是缓存新闻时，额外展示缓存提示和最近一次成功更新时间
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

      {loading ? ( // 根据当前状态切换不同界面
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

// 渲染单条新闻卡片
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
  const markerLeft = `${sentimentPosition(item.sentiment, item.score)}%`; // 计算情绪指示器在刻度条上的位置

  return (
    <TouchableOpacity // 整条新闻可点击
      key={item.id}
      activeOpacity={0.82}
      onPress={() => openLink(item.link)}
      style={[styles.article, { borderBottomColor: colors.border }]}
      // 新闻头部信息
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
          <View // 情绪位置指示器
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

// 样式定义区
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
