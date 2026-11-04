import { useCallback, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";

/** Refresh saved data while its screen is visible; ignore responses from a previous project. */
export function useFocusedResource<T>(load: () => Promise<T>, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  useFocusEffect(useCallback(() => {
    if (!enabled) return;
    let cancelled = false;
    let requestId = 0;
    let inFlight = false;
    setData(null);
    setError(null);
    setLoading(true);
    const refresh = async () => {
      const id = ++requestId;
      inFlight = true;
      try {
        const next = await load();
        if (cancelled || id !== requestId) return;
        setData(next);
        setError(null);
      } catch (err) {
        if (!cancelled && id === requestId) setError(err instanceof Error ? err.message : "Could not refresh project data.");
      } finally {
        if (!cancelled && id === requestId) {
          inFlight = false;
          setLoading(false);
        }
      }
    };
    refreshRef.current = refresh;
    void refresh();
    const timer = setInterval(() => {
      if (!inFlight && AppState.currentState === "active") void refresh();
    }, 15000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
      subscription.remove();
      refreshRef.current = async () => {};
    };
  }, [load, enabled]));

  const refresh = useCallback(() => refreshRef.current(), []);
  return { data, error, loading, refresh };
}
