
import React, { useContext } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ThemeContext } from "../_layout";

type NewsItem = {
  id: string;
  title: string;
  source: string;
  sentiment: "Positive" | "Negative" | "Neutral";
};

const mockNews: NewsItem[] = [
  {
    id: "1",
    title: "Apple rallies after strong earnings report",
    source: "Bloomberg",
    sentiment: "Positive",
  },
  {
    id: "2",
    title: "Tesla delivery numbers miss analyst expectations",
    source: "Reuters",
    sentiment: "Negative",
  },
  {
    id: "3",
    title: "Nvidia AI demand continues to grow across data centers",
    source: "CNBC",
    sentiment: "Positive",
  },
  {
    id: "4",
    title: "Federal Reserve signals cautious stance on rate cuts",
    source: "WSJ",
    sentiment: "Neutral",
  },
];

function sentimentColor(sentiment: NewsItem["sentiment"]) {
  if (sentiment === "Positive") return "#34c759";
  if (sentiment === "Negative") return "#ff3b30";
  return "#8e8e93";
}

export default function NewsScreen() {
  const { colors } = useContext(ThemeContext);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: colors.text }]}>News</Text>
      <Text style={[styles.subtitle, { color: colors.subtext }]}>
        AI-analyzed market news (FinBERT integration coming)
      </Text>

      {mockNews.map((item) => (
        <View
          key={item.id}
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.headline, { color: colors.text }]}>
            {item.title}
          </Text>

          <View style={styles.metaRow}>
            <Text style={[styles.source, { color: colors.subtext }]}>
              {item.source}
            </Text>

            <Text
              style={[
                styles.sentiment,
                { color: sentimentColor(item.sentiment) },
              ]}
            >
              {item.sentiment}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },

  title: {
    fontSize: 34,
    fontWeight: "800",
  },

  subtitle: {
    marginTop: 6,
    marginBottom: 20,
    fontSize: 14,
  },

  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },

  headline: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },

  metaRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  source: {
    fontSize: 13,
  },

  sentiment: {
    fontSize: 13,
    fontWeight: "700",
  },
});
