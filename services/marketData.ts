const API_BASE = "https://api.twelvedata.com";

export const TWELVE_DATA_API_KEY = "API_HERE";

const QUOTE_CACHE_TTL = 5 * 60 * 1000;
const HISTORY_CACHE_TTL = 5 * 60 * 1000;

type QuoteCacheEntry = {
  data: QuoteData;
  fetchedAt: number;
};

type HistoryCacheEntry = {
  data: TimePoint[];
  fetchedAt: number;
};

const quoteCache: Record<string, QuoteCacheEntry> = {};
const historyCache: Record<string, HistoryCacheEntry> = {};

export type QuoteData = {
  symbol: string;
  name?: string;
  close: number;
  change: number;
  percentChange: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  volume?: number;
};

export type SearchResult = {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
};

export type TimePoint = {
  datetime: string;
  close: number;
};

function hasApiKey() {
  return (
    !!TWELVE_DATA_API_KEY &&
    TWELVE_DATA_API_KEY !== "PASTE_YOUR_TWELVE_DATA_KEY_HERE"
  );
}

function buildUrl(path: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ ...params, apikey: TWELVE_DATA_API_KEY });
  return `${API_BASE}${path}?${qs.toString()}`;
}

function asNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function readJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchQuote(
  symbol: string,
  forceRefresh = false
): Promise<QuoteData> {
  const sym = symbol.trim().toUpperCase();
  const now = Date.now();
  const cached = quoteCache[sym];

  if (!forceRefresh && cached && now - cached.fetchedAt < QUOTE_CACHE_TTL) {
    return cached.data;
  }

  if (!hasApiKey()) {
    return {
      symbol: sym,
      close: 0,
      change: 0,
      percentChange: 0,
    };
  }

  const json = await readJson<any>(buildUrl("/quote", { symbol: sym }));

  if (json?.code || json?.status === "error") {
    throw new Error(json?.message || `Quote lookup failed for ${sym}`);
  }

  const data: QuoteData = {
    symbol: sym,
    name: typeof json?.name === "string" ? json.name : undefined,
    close: asNumber(json?.close),
    change: asNumber(json?.change),
    percentChange: asNumber(json?.percent_change),
    open: asNumber(json?.open),
    high: asNumber(json?.high),
    low: asNumber(json?.low),
    previousClose: asNumber(json?.previous_close),
    volume: asNumber(json?.volume),
  };

  quoteCache[sym] = {
    data,
    fetchedAt: now,
  };

  return data;
}

export async function fetchQuotes(
  symbols: string[],
  forceRefresh = false
): Promise<Record<string, QuoteData>> {
  const clean = Array.from(
    new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))
  );

  const pairs = await Promise.all(
    clean.map(async (symbol) => {
      try {
        const quote = await fetchQuote(symbol, forceRefresh);
        return [symbol, quote] as const;
      } catch {
        return [
          symbol,
          { symbol, close: 0, change: 0, percentChange: 0 },
        ] as const;
      }
    })
  );

  return Object.fromEntries(pairs);
}

export function clearQuoteCache(symbol?: string) {
  if (symbol) {
    delete quoteCache[symbol.trim().toUpperCase()];
    return;
  }

  Object.keys(quoteCache).forEach((key) => {
    delete quoteCache[key];
  });
}

export async function searchSymbols(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  if (!hasApiKey()) {
    const demo = ["AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "META", "SPY", "QQQ"];
    return demo
      .filter((s) => s.includes(q.toUpperCase()))
      .map((symbol) => ({
        symbol,
        name: symbol,
        exchange: "Demo",
        type: "Common Stock",
      }));
  }

  const json = await readJson<any>(
    buildUrl("/symbol_search", { symbol: q, outputsize: "12" })
  );
  const items = Array.isArray(json?.data) ? json.data : [];

  return items
    .map((item: any) => ({
      symbol: String(item?.symbol || "").toUpperCase(),
      name: String(item?.instrument_name || item?.name || ""),
      exchange: String(item?.exchange || ""),
      type: String(item?.instrument_type || item?.type || ""),
    }))
    .filter((item: SearchResult) => !!item.symbol)
    .slice(0, 12);
}

function rangeConfig(range: "1D" | "1W" | "1M" | "6M" | "1Y") {
  switch (range) {
    case "1D":
      return { interval: "1h", outputsize: "8" };
    case "1W":
      return { interval: "1day", outputsize: "7" };
    case "1M":
      return { interval: "1day", outputsize: "30" };
    case "6M":
      return { interval: "1week", outputsize: "26" };
    case "1Y":
      return { interval: "1month", outputsize: "12" };
  }
}

function historyCacheKey(
  symbol: string,
  range: "1D" | "1W" | "1M" | "6M" | "1Y"
) {
  return `${symbol.trim().toUpperCase()}__${range}`;
}

export async function fetchTimeSeries(
  symbol: string,
  range: "1D" | "1W" | "1M" | "6M" | "1Y",
  forceRefresh = false
): Promise<TimePoint[]> {
  const sym = symbol.trim().toUpperCase();
  const key = historyCacheKey(sym, range);
  const now = Date.now();
  const cached = historyCache[key];

  if (!forceRefresh && cached && now - cached.fetchedAt < HISTORY_CACHE_TTL) {
    return cached.data;
  }

  if (!hasApiKey()) {
    return [98, 101, 99, 105, 103, 107, 104, 108].map((close, idx) => ({
      datetime: `${idx}`,
      close,
    }));
  }

  const cfg = rangeConfig(range);
  const json = await readJson<any>(
    buildUrl("/time_series", { symbol: sym, ...cfg })
  );

  if (json?.code || json?.status === "error") {
    throw new Error(json?.message || `History lookup failed for ${sym}`);
  }

  const values = Array.isArray(json?.values) ? json.values : [];

  const data = values
    .map((item: any) => ({
      datetime: String(item?.datetime || ""),
      close: asNumber(item?.close),
    }))
    .filter((item: TimePoint) => item.datetime && Number.isFinite(item.close))
    .reverse();

  historyCache[key] = {
    data,
    fetchedAt: now,
  };

  return data;
}

export function clearHistoryCache(
  symbol?: string,
  range?: "1D" | "1W" | "1M" | "6M" | "1Y"
) {
  if (symbol && range) {
    delete historyCache[historyCacheKey(symbol, range)];
    return;
  }

  if (symbol) {
    const prefix = `${symbol.trim().toUpperCase()}__`;
    Object.keys(historyCache).forEach((key) => {
      if (key.startsWith(prefix)) delete historyCache[key];
    });
    return;
  }

  Object.keys(historyCache).forEach((key) => {
    delete historyCache[key];
  });
}

export function formatVolume(value?: number) {
  if (!value || value <= 0) return "-";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${Math.round(value)}`;
}

export function hasConfiguredApiKey() {
  return hasApiKey();
}