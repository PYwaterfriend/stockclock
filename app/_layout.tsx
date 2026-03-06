import React, { createContext, useEffect, useMemo, useRef, useState } from "react";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useColorScheme } from "@/hooks/use-color-scheme";

/** ---------------- Theme (app-level) ---------------- */
export type ThemePref = "system" | "dark" | "light";

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

/** ---------------- Watchlist ---------------- */
type WatchlistCtx = {
  watchlist: string[];
  addSymbol: (sym: string) => void;
  removeSymbol: (sym: string) => void;
  toggleSymbol: (sym: string) => void;
};

export const WatchlistContext = createContext<WatchlistCtx>({
  watchlist: [],
  addSymbol: () => {},
  removeSymbol: () => {},
  toggleSymbol: () => {},
});

/** ---------------- Alerts ---------------- */
export type AlertRule = "ABOVE" | "BELOW";

export type AlertItem = {
  id: string;
  symbol: string;
  rule: AlertRule;
  target: number;
  createdAt: number; // Date.now()
  enabled: boolean;
};

type AlertsCtx = {
  alerts: AlertItem[];
  addAlert: (a: Omit<AlertItem, "id" | "createdAt">) => string;
  removeAlert: (id: string) => void;
  toggleAlertEnabled: (id: string) => void;
  updateAlert: (id: string, patch: Partial<Omit<AlertItem, "id" | "createdAt">>) => void;
};

export const AlertsContext = createContext<AlertsCtx>({
  alerts: [],
  addAlert: () => "",
  removeAlert: () => {},
  toggleAlertEnabled: () => {},
  updateAlert: () => {},
});

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const STORAGE_KEYS = {
  watchlist: "stockclock_watchlist_v1",
  alerts: "stockclock_alerts_v1",
  themePref: "stockclock_theme_pref_v1",
} as const;

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

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
export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Prevent auto-saving the default state before hydration completes.
  const hydratedRef = useRef(false);

  /** theme preference (system/dark/light) */
  const [themePref, setThemePref] = useState<ThemePref>("system");

  /** watchlist state */
  const [watchlist, setWatchlist] = useState<string[]>(["AAPL", "TSLA", "NVDA"]);

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

  const watchlistCtx = useMemo(
    () => ({ watchlist, addSymbol, removeSymbol, toggleSymbol }),
    [watchlist]
  );

  /** alerts state */
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  // Hydrate persisted state once.
  useEffect(() => {
    let canceled = false;

    (async () => {
      try {
        const [wlRaw, alRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.watchlist),
          AsyncStorage.getItem(STORAGE_KEYS.alerts),
        ]);

        const themeRaw = await AsyncStorage.getItem(STORAGE_KEYS.themePref);
        const themeParsed = safeParseJson<unknown>(themeRaw);
        if (!canceled && (themeParsed === "system" || themeParsed === "dark" || themeParsed === "light")) {
          setThemePref(themeParsed);
        }

        const wlParsed = safeParseJson<unknown>(wlRaw);
        if (!canceled && isStringArray(wlParsed) && wlParsed.length > 0) {
          setWatchlist(wlParsed.map((s) => s.trim().toUpperCase()).filter(Boolean));
        }

        const alParsed = safeParseJson<unknown>(alRaw);
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

  // Persist on change.
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

  const alertsCtx = useMemo(
    () => ({ alerts, addAlert, removeAlert, toggleAlertEnabled, updateAlert }),
    [alerts]
  );

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

  return (
    <ThemeContext.Provider value={themeCtx}>
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
    </ThemeContext.Provider>
  );
}
