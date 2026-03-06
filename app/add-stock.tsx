import React, { useContext, useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, FlatList, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ThemeContext, WatchlistContext } from "./_layout";
import { hasConfiguredApiKey, searchSymbols, type SearchResult } from "../services/marketData";

export default function AddStockScreen() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { addSymbol } = useContext(WatchlistContext);
  const { colors, resolvedScheme } = useContext(ThemeContext);

  useEffect(() => {
    let active = true;
    const handle = setTimeout(async () => {
      const term = q.trim();
      if (!term) {
        setResults([]);
        setError("");
        return;
      }

      setLoading(true);
      setError("");
      try {
        const next = await searchSymbols(term);
        if (active) setResults(next);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Search failed.");
      } finally {
        if (active) setLoading(false);
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [q]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.text }]}>Add Stock</Text>

      {!hasConfiguredApiKey() && (
        <View style={[styles.notice, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.noticeText, { color: colors.subtext }]}>Without an API key this page uses demo search results.</Text>
        </View>
      )}

      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
        value={q}
        onChangeText={setQ}
        placeholder="Search symbol (e.g. AAPL)"
        placeholderTextColor={resolvedScheme === "dark" ? "rgba(255,255,255,0.35)" : "rgba(17,24,39,0.35)"}
        autoCapitalize="characters"
        autoCorrect={false}
      />

      {!!error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}
      {loading && <Text style={[styles.loading, { color: colors.subtext }]}>Searching...</Text>}

      <FlatList
        data={results}
        keyExtractor={(x) => `${x.symbol}-${x.exchange}`}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={() => {
              addSymbol(item.symbol);
              router.back();
            }}
          >
            <Text style={[styles.symbol, { color: colors.text }]}>{item.symbol}</Text>
            <Text style={[styles.name, { color: colors.subtext }]} numberOfLines={1}>{item.name || item.exchange || "Tap to add"}</Text>
            <Text style={[styles.hint, { color: colors.subtext }]}>{item.exchange || item.type || "Tap to add"}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.subtext }]}>
            {q.trim() ? "No results" : "Start typing to search."}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 14 },
  notice: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 12 },
  noticeText: { fontSize: 12, lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 14,
    fontSize: 16,
  },
  row: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  symbol: { fontSize: 18, fontWeight: "800" },
  name: { marginTop: 4, fontSize: 13 },
  hint: { marginTop: 6, fontSize: 12 },
  empty: { marginTop: 20 },
  loading: { marginBottom: 10 },
  error: { marginBottom: 10, fontWeight: "600" },
});
