import { useCallback, useEffect, useState } from "react";

interface Result<T> {
  url: string | null;
  data: T | null;
  error: string | null;
}

async function load<T>(url: string): Promise<Result<T>> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) return { url, data: null, error: json.error ?? "Có lỗi xảy ra" };
    return { url, data: json as T, error: null };
  } catch {
    return { url, data: null, error: "Không kết nối được tới máy chủ" };
  }
}

// Fetches JSON from `url` and refreshes it every `interval` ms (0 = no auto refresh).
export function usePolling<T>(url: string | null, interval: number) {
  const [result, setResult] = useState<Result<T>>({ url: null, data: null, error: null });

  const refresh = useCallback(async () => {
    if (!url) return;
    const next = await load<T>(url);
    // Keep showing the last good data if a background refresh fails.
    setResult((prev) => (next.error && prev.url === url && prev.data ? { ...prev, error: next.error } : next));
  }, [url]);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (!cancelled) void refresh();
    };
    tick();
    const timer = interval ? setInterval(tick, interval) : undefined;
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [refresh, interval]);

  // Ignore results that belong to a previous url (e.g. after navigating to another story).
  const current = result.url === url ? result : { url, data: null, error: null };
  return {
    data: current.data,
    error: current.error,
    loading: current.data === null && current.error === null,
    refresh,
  };
}
