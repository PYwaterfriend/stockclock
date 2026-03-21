import React, { createContext, useEffect, useMemo, useRef, useState } from "react";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { configureMarketDataPrefs } from "@/services/marketData";

// 全局类型定义区
export type ThemePref = "system" | "dark" | "light";
export type DefaultChartRange = "1D" | "1W" | "1M" | "1Y";
export type AutoRefreshSeconds = 0 | 15 | 30 | 60;
export type NewsItemsPerStock = 3 | 5 | 10;

export type ThemeColors = {
  bg: string;
  card: string;
  text: string;
  subtext: string;
  border: string;
  tint: string;
  danger: string;
};

type ThemeCtx = {
  themePref: ThemePref;
  setThemePref: (t: ThemePref) => void;
  resolvedScheme: "dark" | "light";
  colors: ThemeColors;
};

// 主题上下文
export const ThemeContext = createContext<ThemeCtx>({
  themePref: "system",
  setThemePref: () => {},
  resolvedScheme: "light",
  colors: {
    bg: "#ffffff",
    card: "#ffffff",
    text: "#111827",
    subtext: "#6b7280",
    border: "#e5e7eb",
    tint: "#0a84ff",
    danger: "#dc2626",
  },
});

export const unstable_settings = {
  anchor: "(tabs)",
};

type WatchlistCtx = {
  watchlist: string[];
  addSymbol: (sym: string) => void;
  removeSymbol: (sym: string) => void;
  toggleSymbol: (sym: string) => void;
};

// 自选股上下文
export const WatchlistContext = createContext<WatchlistCtx>({
  watchlist: [],
  addSymbol: () => {},
  removeSymbol: () => {},
  toggleSymbol: () => {},
});

export type AlertRule = "ABOVE" | "BELOW";

export type AlertItem = {
  id: string;
  symbol: string;
  rule: AlertRule;
  target: number;
  createdAt: number;
  enabled: boolean;
};

type AlertsCtx = {
  alerts: AlertItem[];
  addAlert: (a: Omit<AlertItem, "id" | "createdAt">) => string;
  removeAlert: (id: string) => void;
  toggleAlertEnabled: (id: string) => void;
  updateAlert: (id: string, patch: Partial<Omit<AlertItem, "id" | "createdAt">>) => void;
};

// 提醒上下文
export const AlertsContext = createContext<AlertsCtx>({
  alerts: [],
  addAlert: () => "",
  removeAlert: () => {},
  toggleAlertEnabled: () => {},
  updateAlert: () => {},
});

export type AppSettings = {
  smartDataMode: boolean;
  useCachedDataWhenOffline: boolean;
  defaultChartRange: DefaultChartRange;
  autoRefreshSeconds: AutoRefreshSeconds;
  newsItemsPerStock: NewsItemsPerStock;
};

type SettingsCtx = {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
};

const DEFAULT_SETTINGS: AppSettings = {
  smartDataMode: true,
  useCachedDataWhenOffline: true,
  defaultChartRange: "1D",
  autoRefreshSeconds: 0,
  newsItemsPerStock: 5,
};

// 应用设置上下文
export const SettingsContext = createContext<SettingsCtx>({
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
});

// 生成唯一ID，用于标识每一条提醒数据
function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// 本地存储 key 定义
const STORAGE_KEYS = {
  watchlist: "stockclock_watchlist_v1",
  alerts: "stockclock_alerts_v1",
  themePref: "stockclock_theme_pref_v1",
  appSettings: "stockclock_app_settings_v1",
} as const;

// 解析JSON
function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// 数据结构校验函数
function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === "string");
}

function isAlertItemArray(x: unknown): x is AlertItem[] {
  return (
    Array.isArray(x) &&
    x.every(
      (a) =>
        a &&
        typeof a === "object" &&
        typeof (a as any).id === "string" &&
        typeof (a as any).symbol === "string" &&
        ((a as any).rule === "ABOVE" || (a as any).rule === "BELOW") &&
        typeof (a as any).target === "number" &&
        typeof (a as any).createdAt === "number" &&
        typeof (a as any).enabled === "boolean"
    )
  );
}

function isAppSettings(x: unknown): x is AppSettings {
  return (
    !!x &&
    typeof x === "object" &&
    typeof (x as any).smartDataMode === "boolean" &&
    typeof (x as any).useCachedDataWhenOffline === "boolean" &&
    ["1D", "1W", "1M", "1Y"].includes(String((x as any).defaultChartRange)) &&
    [0, 15, 30, 60].includes(Number((x as any).autoRefreshSeconds)) &&
    [3, 5, 10].includes(Number((x as any).newsItemsPerStock))
  );
}

// 应用根布局组件
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const hydratedRef = useRef(false);

  const [themePref, setThemePref] = useState<ThemePref>("system");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [watchlist, setWatchlist] = useState<string[]>(["AAPL", "TSLA", "NVDA"]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  // 自选股操作方法
  const addSymbol = (sym: string) => {
    const s = sym.trim().toUpperCase();
    if (!s) return;
    setWatchlist((prev) => (prev.includes(s) ? prev : [s, ...prev]));
  };

  const removeSymbol = (sym: string) => {
    const s = sym.trim().toUpperCase();
    if (!s) return;
    setWatchlist((prev) => prev.filter((x) => x !== s));
  };

  const toggleSymbol = (sym: string) => {
    const s = sym.trim().toUpperCase();
    if (!s) return;
    setWatchlist((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [s, ...prev]));
  };

  useEffect(() => {
    let canceled = false;

    (async () => {
      try {
        const [wlRaw, alRaw, themeRaw, settingsRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.watchlist),
          AsyncStorage.getItem(STORAGE_KEYS.alerts),
          AsyncStorage.getItem(STORAGE_KEYS.themePref),
          AsyncStorage.getItem(STORAGE_KEYS.appSettings),
        ]);

        const themeParsed = parseJson<unknown>(themeRaw);
        if (!canceled && (themeParsed === "system" || themeParsed === "dark" || themeParsed === "light")) {
          setThemePref(themeParsed);
        }

        const settingsParsed = parseJson<unknown>(settingsRaw);
        if (!canceled && isAppSettings(settingsParsed)) {
          setSettings(settingsParsed);
        }

        const wlParsed = parseJson<unknown>(wlRaw);
        if (!canceled && isStringArray(wlParsed) && wlParsed.length > 0) {
          setWatchlist(wlParsed.map((s) => s.trim().toUpperCase()).filter(Boolean));
        }

        const alParsed = parseJson<unknown>(alRaw);
        if (!canceled && isAlertItemArray(alParsed)) {
          setAlerts(
            alParsed
              .map((a) => ({ ...a, symbol: a.symbol.trim().toUpperCase() }))
              .filter((a) => a.symbol)
          );
        }
      } finally {
        if (!canceled) hydratedRef.current = true;
      }
    })();

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    configureMarketDataPrefs({ smartDataMode: settings.smartDataMode });
  }, [settings.smartDataMode]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    AsyncStorage.setItem(STORAGE_KEYS.watchlist, JSON.stringify(watchlist)).catch(() => {});
  }, [watchlist]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    AsyncStorage.setItem(STORAGE_KEYS.alerts, JSON.stringify(alerts)).catch(() => {});
  }, [alerts]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    AsyncStorage.setItem(STORAGE_KEYS.themePref, JSON.stringify(themePref)).catch(() => {});
  }, [themePref]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    AsyncStorage.setItem(STORAGE_KEYS.appSettings, JSON.stringify(settings)).catch(() => {});
  }, [settings]);

  // 提醒相关操作
  const addAlert = (a: Omit<AlertItem, "id" | "createdAt">) => {
    const id = makeId();
    const item: AlertItem = { ...a, id, createdAt: Date.now() };
    setAlerts((prev) => [item, ...prev]);
    return id;
  };

  const removeAlert = (id: string) => {
    setAlerts((prev) => prev.filter((x) => x.id !== id));
  };

  const toggleAlertEnabled = (id: string) => {
    setAlerts((prev) => prev.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x)));
  };

  const updateAlert = (id: string, patch: Partial<Omit<AlertItem, "id" | "createdAt">>) => {
    setAlerts((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  // 更新应用设置
  const updateSettings = (patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const resolvedScheme = themePref === "system" ? (colorScheme === "dark" ? "dark" : "light") : themePref;
  const colors: ThemeColors =
    resolvedScheme === "dark"
      ? {
          bg: "#0a0a0a",
          card: "rgba(255, 255, 255, 0.05)",
          text: "#ffffff",
          subtext: "rgba(255, 255, 255, 0.6)",
          border: "rgba(255, 255, 255, 0.08)",
          tint: "#0a84ff",
          danger: "#ef4444",
        }
      : {
          bg: "#ffffff",
          card: "#ffffff",
          text: "#111827",
          subtext: "#6b7280",
          border: "#e5e7eb",
          tint: "#0a84ff",
          danger: "#dc2626",
        };

  const themeCtx = useMemo(
    () => ({ themePref, setThemePref, resolvedScheme, colors }),
    [themePref, resolvedScheme, colors]
  );

  const watchlistCtx = useMemo(
    () => ({ watchlist, addSymbol, removeSymbol, toggleSymbol }),
    [watchlist]
  );

  const alertsCtx = useMemo(
    () => ({ alerts, addAlert, removeAlert, toggleAlertEnabled, updateAlert }),
    [alerts]
  );

  const settingsCtx = useMemo(
    () => ({ settings, updateSettings }),
    [settings]
  );

  // 应用根结构
  return (
    <ThemeContext.Provider value={themeCtx}>
      <SettingsContext.Provider value={settingsCtx}>
        <AlertsContext.Provider value={alertsCtx}>
          <WatchlistContext.Provider value={watchlistCtx}>
            <ThemeProvider value={resolvedScheme === "dark" ? DarkTheme : DefaultTheme}>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              </Stack>
              <StatusBar style={resolvedScheme === "dark" ? "light" : "dark"} />
            </ThemeProvider>
          </WatchlistContext.Provider>
        </AlertsContext.Provider>
      </SettingsContext.Provider>
    </ThemeContext.Provider>
  );
}
