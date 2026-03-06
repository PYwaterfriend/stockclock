import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { WatchlistContext, ThemeContext } from "../_layout";
import { fetchQuotes, hasConfiguredApiKey, type QuoteData } from "../../services/marketData";

type RowData = QuoteData & { symbol: string };

function fmtPct(x: number) {
  const sign = x > 0 ? "+" : "";
  return `${sign}${x.toFixed(2)}%`;
}

function fmtMoney(x: number) {
  return x > 0 ? `$${x.toFixed(2)}` : "--";
}

export default function StocksScreen() {
  const router = useRouter();
  const { watchlist } = useContext(WatchlistContext);
  const { colors } = useContext(ThemeContext);

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

//  useEffect(() => {
//    loadQuotes();
//  }, [watchlist.join(",")]);

  const data = useMemo<RowData[]>(() => {
    return watchlist.map((symbol) => quotes[symbol] ?? { symbol, close: 0, change: 0, percentChange: 0 });
  }, [watchlist, quotes]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>Watchlist</Text>
        <Pressable
          style={[styles.refreshBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
          onPress={loadQuotes}
        >
          <Text style={[styles.refreshText, { color: colors.text }]}>Refresh</Text>
        </Pressable>
      </View>

      {!hasConfiguredApiKey() && (
        <View style={[styles.notice, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.noticeText, { color: colors.subtext }]}>
            Add your Twelve Data API key in services/marketData.ts to load real stock prices.
          </Text>
        </View>
      )}

      {!!error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

      <FlatList
        data={data}
        keyExtractor={(it) => it.symbol}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadQuotes} />}
        renderItem={({ item }) => {
          const up = item.percentChange >= 0;
          return (
            <Pressable
              style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() => router.push(`/stock/${item.symbol}`)}
            >
              <View>
                <Text style={[styles.symbol, { color: colors.text }]}>{item.symbol}</Text>
                <Text style={[styles.sub, { color: colors.subtext }]}>Tap to open details</Text>
              </View>

              <View style={styles.right}>
                <Text style={[styles.price, { color: colors.text }]}>{fmtMoney(item.close)}</Text>
                <Text style={[styles.change, { color: up ? "#34c759" : colors.danger }]}>
                  {fmtPct(item.percentChange)}
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={{ marginTop: 20, color: colors.subtext }}>
            No stocks yet. Tap “Add Stock”.
          </Text>
        }
      />

      <Pressable
        style={[styles.addBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
        onPress={() => router.push("/add-stock")}
      >
        <Text style={[styles.addText, { color: colors.text }]}>Add Stock</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 16 },
  refreshBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  refreshText: { fontSize: 13, fontWeight: "700" },
  notice: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  noticeText: { fontSize: 12, lineHeight: 18 },
  error: { marginBottom: 12, fontSize: 13, fontWeight: "600" },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  symbol: { fontSize: 18, fontWeight: "800" },
  sub: { marginTop: 4, fontSize: 12 },
  right: { alignItems: "flex-end" },
  price: { fontSize: 16, fontWeight: "700" },
  change: { marginTop: 4, fontSize: 14, fontWeight: "700" },
  sep: { height: 10 },
  addBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  addText: { fontSize: 16, fontWeight: "800" },
});
