import { useCallback, useEffect, useRef, useState } from "react";
import { fetchStats, fetchUsers, setApproval, UnauthorizedError, type AdminUser, type ApprovalStatus } from "./api";

const ACCOUNTS_POLL_MS = 5_000;

/** Keep filters and the last successful rows in place during quiet background refreshes. */
export function useAccounts(
  filters: { status: string; role: string; q: string },
  onError: (error: unknown) => void,
  onPendingCount: (count: number) => void,
) {
  const { status, role, q } = filters;
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  // The ref closes the gap before React renders disabled action buttons.
  const mutating = useRef(false);
  const mounted = useRef(false);
  const refresh = useRef<(() => void) | null>(null);
  const pause = useRef<(() => void) | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight: AbortController | null = null;

    const cancel = () => {
      clearTimeout(timer);
      inFlight?.abort();
      inFlight = null;
    };
    const load = async () => {
      if (stopped || document.hidden || mutating.current || inFlight) return;
      clearTimeout(timer);
      const controller = new AbortController();
      inFlight = controller;
      try {
        const results = await Promise.allSettled([
          fetchUsers({ status, role, q }, controller.signal),
          fetchStats(controller.signal),
        ]);
        // Aborted/older-filter responses must never replace the current account list.
        if (stopped || controller.signal.aborted) return;
        const expired = results.find((r) => r.status === "rejected" && r.reason instanceof UnauthorizedError);
        if (expired?.status === "rejected") {
          stopped = true;
          onError(expired.reason);
          return;
        }
        const [accounts, stats] = results;
        if (accounts.status === "fulfilled") setUsers(accounts.value);
        if (stats.status === "fulfilled") onPendingCount(stats.value.totals.pending);
        setRefreshError(results.some((r) => r.status === "rejected")
          ? "Unable to refresh all account data. Keeping the last available results and retrying automatically."
          : null);
      } finally {
        // Schedule after completion, so slow requests never accumulate overlapping polls.
        if (inFlight === controller) {
          inFlight = null;
          if (!stopped && !document.hidden && !mutating.current) timer = setTimeout(() => void load(), ACCOUNTS_POLL_MS);
        }
      }
    };
    const reload = () => { cancel(); void load(); };
    const visibilityChanged = () => {
      if (document.hidden) cancel();
      else reload();
    };
    refresh.current = reload;
    pause.current = cancel;
    document.addEventListener("visibilitychange", visibilityChanged);
    // Preserve the existing search debounce, including during StrictMode setup/cleanup.
    timer = setTimeout(() => void load(), q ? 250 : 0);
    return () => {
      stopped = true;
      cancel();
      document.removeEventListener("visibilitychange", visibilityChanged);
      if (refresh.current === reload) refresh.current = null;
      if (pause.current === cancel) pause.current = null;
    };
  }, [status, role, q, onError, onPendingCount]);

  const decide = useCallback(async (user: AdminUser, next: ApprovalStatus) => {
    if (mutating.current || !mounted.current) return;
    mutating.current = true;
    setBusy(true);
    setMessage(null);
    // Invalidate reads started before this action; they may contain the old status.
    pause.current?.();
    let expired = false;
    try {
      await setApproval(user.id, next);
      if (mounted.current) setMessage({
        text: next === "approved" ? "Account access approved."
          : user.approval_status === "approved" ? "Account access revoked." : "Account rejected.",
        success: true,
      });
    } catch (error) {
      if (mounted.current) {
        if (error instanceof UnauthorizedError) {
          expired = true;
          onError(error);
        }
        setMessage({ text: error instanceof Error ? error.message : "Update failed.", success: false });
      }
    } finally {
      mutating.current = false;
      if (mounted.current) {
        setBusy(false);
        if (!expired) refresh.current?.();
      }
    }
  }, [onError]);

  return { users, refreshError, message, busy, decide };
}
