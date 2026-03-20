import React, { useContext, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { WatchlistContext, ThemeContext } from "../_layout";
import { fetchQuotes, hasConfiguredApiKey, type QuoteData } from "../../services/marketData";

type RowData = QuoteData & { symbol: string; name?: string };

function fmtPct(x: number) {
  const sign = x > 0 ? "+" : "";
  return `${sign}${x.toFixed(2)}%`;
}

function fmtDelta(x: number) {
  const sign = x > 0 ? "+" : x < 0 ? "-" : "";
  return `${sign}$${Math.abs(x).toFixed(2)}`;
}

function fmtMoney(x: number) {
  return x > 0 ? `$${x.toFixed(2)}` : "--";
}

export default function StocksScreen() {
  const router = useRouter();
  const { watchlist, removeSymbol } = useContext(WatchlistContext);
  const { colors, resolvedScheme } = useContext(ThemeContext);

  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadQuotes = async () => {
    if (watchlist.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const next = await fetchQuotes(watchlist);
      setQuotes(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load quotes.");
    } finally {
      setLoading(false);
    }
  };

  const data = useMemo<RowData[]>(() => {
    return watchlist.map((symbol) => quotes[symbol] ?? { symbol, name: undefined, close: 0, change: 0, percentChange: 0 });
  }, [watchlist, quotes]);

  const confirmRemove = (symbol: string) => {
    Alert.alert(
      "Remove from watchlist?",
      `${symbol} will be removed from your watchlist.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeSymbol(symbol),
        },
      ]
    );
  };

  const positiveColor = resolvedScheme === "dark" ? "#4ade80" : "#16a34a";
  const negativeColor = colors.danger;
  const mutedBg = resolvedScheme === "dark" ? "#10151c" : "#f8fafc";
  const lineColor = resolvedScheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.09)";

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}> 
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.subtext }]}>Markets</Text>
          <Text style={[styles.title, { color: colors.text }]}>Watchlist</Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.refreshBtn,
            {
              borderColor: colors.border,
              backgroundColor: colors.card,
              opacity: pressed ? 0.78 : 1,
            },
          ]}
          onPress={loadQuotes}
        >
          <Text style={[styles.refreshIcon, { color: colors.text }]}>↻</Text>
        </Pressable>
      </View>

      {!hasConfiguredApiKey() && (
        <View style={[styles.notice, { borderColor: colors.border, backgroundColor: mutedBg }]}> 
          <Text style={[styles.noticeTitle, { color: colors.text }]}>Market data setup needed</Text>
          <Text style={[styles.noticeText, { color: colors.subtext }]}> 
            Add your Twelve Data API key in services/marketData.ts to load live quotes.
          </Text>
        </View>
      )}

      {!!error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

      <View style={[styles.tableHead, { borderBottomColor: lineColor }]}> 
        <Text style={[styles.tableHeadText, { color: colors.subtext }]}>Symbol</Text>
        <Text style={[styles.tableHeadText, styles.tableHeadRight, { color: colors.subtext }]}>Last / Change</Text>
      </View>

      <FlatList
        data={data}
        keyExtractor={(it) => it.symbol}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={data.length === 0 ? styles.emptyContainer : styles.listContent}
        ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: lineColor }]} />}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadQuotes} />}
        renderItem={({ item }) => {
          const up = item.percentChange >= 0;
          const moveColor = up ? positiveColor : negativeColor;
          return (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: pressed ? colors.card : "transparent",
                },
              ]}
              onPress={() => router.push(`/stock/${item.symbol}`)}
              onLongPress={() => confirmRemove(item.symbol)}
              delayLongPress={260}
            >
              <View style={styles.leftBlock}>
                <Text style={[styles.symbol, { color: colors.text }]}>{item.symbol}</Text>
                {!!item.name && (
                  <Text
                    style={[styles.companyName, { color: colors.subtext }]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                )}
              </View>

              <View style={styles.right}>
                <Text style={[styles.price, { color: colors.text }]}>{fmtMoney(item.close)}</Text>
                <Text style={[styles.changeText, { color: moveColor }]}>
                  {fmtDelta(item.change)} ({fmtPct(item.percentChange)})
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={[styles.emptyCard, { borderColor: colors.border, backgroundColor: colors.card }]}> 
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Your watchlist is empty</Text>
            <Text style={[styles.emptyText, { color: colors.subtext }]}>Add a few symbols to start tracking prices here.</Text>
          </View>
        }
      />

      <Pressable
        style={({ pressed }) => [
          styles.addBtn,
          {
            borderColor: colors.border,
            backgroundColor: colors.card,
            opacity: pressed ? 0.88 : 1,
          },
        ]}
        onPress={() => router.push("/add-stock")}
      >
        <Text style={[styles.addPlus, { color: colors.text }]}>＋</Text>
        <Text style={[styles.addText, { color: colors.text }]}>Add Stock</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 58, paddingBottom: 20 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.6 },
  refreshBtn: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshIcon: { fontSize: 18, fontWeight: "700" },
  notice: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  noticeText: { fontSize: 12, lineHeight: 18 },
  error: { marginBottom: 12, fontSize: 13, fontWeight: "600" },
  tableHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
    marginBottom: 2,
    borderBottomWidth: 1,
  },
  tableHeadText: {
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  tableHeadRight: {
    textAlign: "right",
  },
  listContent: {
    paddingBottom: 10,
  },
  row: {
    minHeight: 74,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 12,
  },
  leftBlock: {
    flex: 1,
    paddingRight: 12,
    justifyContent: "center",
  },
  symbol: {
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  companyName: {
    marginTop: 3,
    fontSize: 12.5,
    fontWeight: "500",
  },
  right: {
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 128,
  },
  price: { fontSize: 18, fontWeight: "800" },
  changeText: {
    marginTop: 5,
    fontSize: 13,
    fontWeight: "700",
  },
  sep: { height: 1 },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 10,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 22,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 240,
  },
  addBtn: {
    marginTop: 18,
    paddingVertical: 15,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
  },
  addPlus: { fontSize: 18, fontWeight: "700" },
  addText: { fontSize: 16, fontWeight: "800" },
});
