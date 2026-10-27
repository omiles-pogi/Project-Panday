import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  adminLogin,
  fetchProjects,
  fetchStats,
  fetchUsers,
  getToken,
  logout,
  setApproval,
  setToken,
  UnauthorizedError,
  type AdminProject,
  type AdminUser,
  type ApprovalStatus,
  type Stats,
} from "./api";

const STATUS_COLOR: Record<ApprovalStatus, string> = {
  pending: "#f59e0b",
  approved: "#10b981",
  rejected: "#ef4444",
};
const ROLE_COLOR: Record<string, string> = {
  homeowner: "#3b82f6",
  contractor: "#10b981",
  supplier: "#8b5cf6",
  worker: "#f43f5e",
};

const card = { background: "var(--color-card)", border: "1px solid var(--color-border)" };
const input = { background: "var(--color-muted)", border: "1px solid var(--color-border)", color: "var(--color-foreground)" };

const THEME_KEY = "panday_admin_theme";
type ThemeMode = "dark" | "light";

function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      return saved === "light" || saved === "dark" ? saved : "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch {
      // storage unavailable: the preference just won't persist across reloads
    }
  }, [mode]);

  const toggle = useCallback(() => setMode((m) => (m === "dark" ? "light" : "dark")), []);
  return { mode, toggle };
}

function ThemeToggle({ mode, onToggle }: { mode: ThemeMode; onToggle: () => void }) {
  const isDark = mode === "dark";
  return (
    <button
      onClick={onToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
      style={{ background: "var(--color-muted)", border: "1px solid var(--color-border)" }}
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}

const STATS_POLL_MS = 20_000;
const BAR_TRANSITION = "width 700ms cubic-bezier(0.22, 1, 0.36, 1)";

/** Animates a number counting up/down to its latest value instead of popping to it instantly —
 * used for every stat tile so a live refresh reads as a change, not a flicker. */
function useCountUp(value: number, duration = 650): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return display;
}

function CountUp({ value }: { value: number }) {
  return <>{useCountUp(value)}</>;
}

/** "3s ago" / "2m ago", ticking its own 1s timer rather than freezing at render time. */
function useRelativeTime(since: Date | null): string {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (!since) return "";
  const secs = Math.max(0, Math.round((Date.now() - since.getTime()) / 1000));
  if (secs < 2) return "just now";
  if (secs < 60) return `${secs}s ago`;
  return `${Math.round(secs / 60)}m ago`;
}

export default function AdminApp() {
  const [authed, setAuthed] = useState(() => !!getToken());
  const { mode, toggle } = useTheme();

  const signOut = useCallback(async () => {
    await logout();
    setToken(null);
    setAuthed(false);
  }, []);

  if (!authed) {
    return (
      <LoginView
        mode={mode}
        onToggleTheme={toggle}
        onLogin={(token) => {
          setToken(token);
          setAuthed(true);
        }}
      />
    );
  }
  return (
    <Portal
      mode={mode}
      onToggleTheme={toggle}
      onSignOut={signOut}
      onExpired={() => {
        setToken(null);
        setAuthed(false);
      }}
    />
  );
}

function LoginView({
  mode,
  onToggleTheme,
  onLogin,
}: {
  mode: ThemeMode;
  onToggleTheme: () => void;
  onLogin: (token: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onLogin(await adminLogin(email.trim(), password));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center px-4 relative" style={{ background: "var(--color-background)" }}>
      <div className="absolute top-4 right-4">
        <ThemeToggle mode={mode} onToggle={onToggleTheme} />
      </div>
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl p-8" style={card}>
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--color-foreground)" }}>Project-Panday Admin</h1>
        <p className="text-sm mb-6" style={{ color: "var(--color-muted-foreground)" }}>Authorized administrator only.</p>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--color-secondary-foreground)" }}>Email</label>
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-4"
          style={input}
        />
        <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--color-secondary-foreground)" }}>Password</label>
        <div className="flex rounded-xl mb-4" style={input}>
          <input
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="flex-1 px-4 py-3 text-sm outline-none bg-transparent"
            style={{ color: "var(--color-foreground)" }}
          />
          <button type="button" onClick={() => setShow((s) => !s)} className="px-4 text-xs font-semibold" style={{ color: "var(--color-secondary-foreground)" }}>
            {show ? "Hide" : "Show"}
          </button>
        </div>
        {error && <p className="text-sm mb-4" style={{ color: "#ef4444" }}>{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full py-3 rounded-xl text-sm font-bold"
          style={{ background: "#f59e0b", color: "#0f1117", opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

function Portal({
  mode,
  onToggleTheme,
  onSignOut,
  onExpired,
}: {
  mode: ThemeMode;
  onToggleTheme: () => void;
  onSignOut: () => void;
  onExpired: () => void;
}) {
  const [tab, setTab] = useState<"overview" | "accounts">("accounts");
  const [pending, setPending] = useState<number | null>(null);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof UnauthorizedError) onExpired();
    },
    [onExpired],
  );

  return (
    <div className="min-h-full" style={{ background: "var(--color-background)" }}>
      <header
        className="flex items-center justify-between px-6 py-4"
        style={{ background: "var(--color-card)", borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-6">
          <span className="font-bold" style={{ color: "var(--color-foreground)" }}>Project-Panday Admin</span>
          {(["accounts", "overview"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="text-sm font-semibold capitalize pb-0.5"
              style={{
                color: tab === t ? "#f59e0b" : "var(--color-muted-foreground)",
                borderBottom: tab === t ? "2px solid #f59e0b" : "2px solid transparent",
              }}
            >
              {t === "accounts" ? `Accounts${pending ? ` (${pending})` : ""}` : "Analytics"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle mode={mode} onToggle={onToggleTheme} />
          <button onClick={onSignOut} className="text-sm font-semibold" style={{ color: "#ef4444" }}>Sign out</button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-6">
        {tab === "overview" ? (
          <Analytics onError={handleError} />
        ) : (
          <Accounts onError={handleError} onPendingCount={setPending} />
        )}
      </main>
    </div>
  );
}

function Analytics({ onError }: { onError: (e: unknown) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const relativeTime = useRelativeTime(lastUpdated);

  const load = useCallback((silent: boolean) => {
    if (!silent) setRefreshing(true);
    fetchStats()
      .then((s) => {
        setStats(s);
        setLastUpdated(new Date());
      })
      .catch(onError)
      .finally(() => setRefreshing(false));
  }, [onError]);

  // Initial load, then a quiet poll every 20s so the page reads as live rather than a
  // one-time snapshot you have to manually reload to refresh.
  useEffect(() => {
    load(false);
    const id = setInterval(() => load(true), STATS_POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Bars grow in from 0 only on first paint — later refreshes update their width directly, which
  // the CSS transition on each bar animates smoothly between the old and new values on its own.
  useEffect(() => {
    if (!stats || revealed) return;
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, [stats, revealed]);

  if (!stats) return <p style={{ color: "var(--color-muted-foreground)" }}>Loading…</p>;
  const t = stats.totals;
  const maxSignup = Math.max(1, ...stats.signups.map((s) => s.total));
  const maxRole = Math.max(1, ...stats.by_role.map((r) => r.total));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full animate-ping" style={{ background: "#10b98180" }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "#10b981" }} />
          </span>
          <span style={{ color: "#10b981" }}>Live</span>
          <span>· updated {relativeTime}</span>
        </div>
        <button
          onClick={() => load(false)}
          disabled={refreshing}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: "var(--color-muted)", color: refreshing ? "var(--color-muted-foreground)" : "var(--color-foreground)" }}
        >
          {refreshing ? "Refreshing…" : "Refresh now"}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Total users", value: t.users, color: "var(--color-foreground)" },
          { label: "Pending", value: t.pending, color: STATUS_COLOR.pending },
          { label: "Approved", value: t.approved, color: STATUS_COLOR.approved },
          { label: "Rejected", value: t.rejected, color: STATUS_COLOR.rejected },
          { label: "Active (7d)", value: t.active_7d, color: "#3b82f6" },
          { label: "New (7d)", value: t.new_7d, color: "#8b5cf6" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-4 transition-colors" style={card}>
            <div className="text-xs mb-1" style={{ color: "var(--color-muted-foreground)" }}>{s.label}</div>
            <div className="text-3xl font-bold" style={{ color: s.color }}>
              <CountUp value={s.value} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="rounded-2xl p-5" style={card}>
          <h2 className="font-semibold text-sm mb-4" style={{ color: "var(--color-foreground)" }}>Users by role</h2>
          <div className="space-y-3">
            {stats.by_role.map((r) => (
              <div key={r.role}>
                <div className="flex justify-between text-xs mb-1" style={{ color: "var(--color-secondary-foreground)" }}>
                  <span className="capitalize">{r.role}</span>
                  <span><CountUp value={r.total} /></span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--color-muted)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: revealed ? `${(r.total / maxRole) * 100}%` : "0%",
                      background: ROLE_COLOR[r.role],
                      transition: BAR_TRANSITION,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl p-5" style={card}>
          <h2 className="font-semibold text-sm mb-4" style={{ color: "var(--color-foreground)" }}>Sign-ups, last 14 days</h2>
          <div className="flex items-end gap-1.5" style={{ height: 140 }}>
            {stats.signups.map((s) => (
              <div key={s.date} className="flex-1 flex flex-col justify-end items-center h-full" title={`${s.date}: ${s.total}`}>
                <div className="text-[10px]" style={{ color: "var(--color-secondary-foreground)" }}>{s.total || ""}</div>
                <div
                  className="w-full rounded-t"
                  style={{
                    height: revealed ? `${(s.total / maxSignup) * 100}%` : "0%",
                    minHeight: revealed && s.total ? 4 : 2,
                    background: s.total ? "#f59e0b" : "var(--color-muted)",
                    transition: `height 700ms cubic-bezier(0.22, 1, 0.36, 1)`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] mt-2" style={{ color: "var(--color-muted-foreground)" }}>
            <span>{stats.signups[0]?.date.slice(5)}</span>
            <span>{stats.signups[stats.signups.length - 1]?.date.slice(5)}</span>
          </div>
        </section>
      </div>

      <section className="rounded-2xl p-5" style={card}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm" style={{ color: "var(--color-foreground)" }}>Project progress</h2>
          <div className="flex gap-4 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
            <span>Total: <span style={{ color: "var(--color-foreground)" }}><CountUp value={stats.projects.total} /></span></span>
            <span>Active: <span style={{ color: "#f59e0b" }}><CountUp value={stats.projects.active} /></span></span>
            <span>Completed: <span style={{ color: "#10b981" }}><CountUp value={stats.projects.completed} /></span></span>
            <span>Avg progress: <span style={{ color: "var(--color-foreground)" }}><CountUp value={stats.projects.avg_progress} />%</span></span>
          </div>
        </div>
        <ProjectProgressList onError={onError} />
      </section>
    </div>
  );
}

function ProjectProgressList({ onError }: { onError: (e: unknown) => void }) {
  const [projects, setProjects] = useState<AdminProject[] | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const load = () => fetchProjects().then(setProjects).catch(onError);
    load();
    const id = setInterval(load, STATS_POLL_MS);
    return () => clearInterval(id);
  }, [onError]);

  useEffect(() => {
    if (!projects || revealed) return;
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, [projects, revealed]);

  if (!projects) return <p style={{ color: "var(--color-muted-foreground)" }}>Loading…</p>;
  if (projects.length === 0) return <p className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>No projects yet.</p>;

  return (
    <div className="space-y-3">
      {projects.map((p) => (
        <div key={p.id} className="rounded-xl px-4 py-3" style={{ background: "var(--color-muted)" }}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: "var(--color-foreground)" }}>{p.title}</div>
              <div className="text-xs truncate" style={{ color: "var(--color-muted-foreground)" }}>
                {p.owner.name} · {p.owner.email}
                {p.location ? ` · ${p.location}` : ""}
              </div>
            </div>
            <span
              className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize flex-shrink-0"
              style={{
                background: p.status === "completed" ? "#10b98120" : "#f59e0b20",
                color: p.status === "completed" ? "#10b981" : "#f59e0b",
              }}
            >
              {p.status}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--color-card)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: revealed ? `${p.overallProgressPct}%` : "0%",
                  background: p.overallProgressPct === 100 ? "#10b981" : "#f59e0b",
                  transition: BAR_TRANSITION,
                }}
              />
            </div>
            <span className="text-xs font-semibold w-10 text-right" style={{ color: "var(--color-secondary-foreground)" }}>
              <CountUp value={p.overallProgressPct} />%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

const FILTERS: { label: string; value: string }[] = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "All", value: "" },
];

function Accounts({ onError, onPendingCount }: { onError: (e: unknown) => void; onPendingCount: (n: number) => void }) {
  const [status, setStatus] = useState("pending");
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchUsers({ status, role, q })
      .then(setUsers)
      .catch(onError);
    fetchStats().then((s) => onPendingCount(s.totals.pending)).catch(onError);
  }, [status, role, q, onError, onPendingCount]);

  useEffect(() => {
    const id = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(id);
  }, [load, q]);

  const decide = async (user: AdminUser, next: ApprovalStatus) => {
    setMessage(null);
    try {
      await setApproval(user.id, next);
      load();
    } catch (err) {
      onError(err);
      setMessage(err instanceof Error ? err.message : "Update failed.");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex rounded-xl overflow-hidden" style={card}>
          {FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => setStatus(f.value)}
              className="px-4 py-2 text-sm font-semibold"
              style={{ background: status === f.value ? "#f59e0b20" : "transparent", color: status === f.value ? "#f59e0b" : "var(--color-secondary-foreground)" }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value)} className="px-3 py-2 rounded-xl text-sm" style={input}>
          <option value="">All roles</option>
          {Object.keys(ROLE_COLOR).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <input
          placeholder="Search name or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm outline-none flex-1 min-w-48"
          style={input}
        />
      </div>

      {message && <p className="text-sm mb-3" style={{ color: "#ef4444" }}>{message}</p>}

      <div className="rounded-2xl overflow-x-auto" style={card}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs" style={{ color: "var(--color-muted-foreground)", borderBottom: "1px solid var(--color-border)" }}>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Verification</th>
              <th className="px-4 py-3">Registered</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {users === null && (
              <tr><td colSpan={7} className="px-4 py-6 text-center" style={{ color: "var(--color-muted-foreground)" }}>Loading…</td></tr>
            )}
            {users?.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center" style={{ color: "var(--color-muted-foreground)" }}>No accounts match.</td></tr>
            )}
            {users?.map((u) => (
              <tr key={u.id} style={{ borderBottom: "1px solid var(--color-border-soft)" }}>
                <td className="px-4 py-3 font-medium" style={{ color: "var(--color-foreground)" }}>{u.name}</td>
                <td className="px-4 py-3" style={{ color: "var(--color-secondary-foreground)" }}>{u.email}</td>
                <td className="px-4 py-3 capitalize" style={{ color: ROLE_COLOR[u.role] }}>{u.role}</td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--color-secondary-foreground)" }}>
                  {u.license_number ? (<>{u.business_name && <div style={{ color: "var(--color-foreground)" }}>{u.business_name}</div>}<div>{u.license_number}</div></>) : "—"}
                </td>
                <td className="px-4 py-3" style={{ color: "var(--color-muted-foreground)" }}>{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize" style={{ background: `${STATUS_COLOR[u.approval_status]}20`, color: STATUS_COLOR[u.approval_status] }}>
                    {u.approval_status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {u.approval_status !== "approved" && (
                    <button onClick={() => decide(u, "approved")} className="px-3 py-1.5 rounded-lg text-xs font-semibold mr-2" style={{ background: "#10b98120", color: "#10b981" }}>
                      Approve
                    </button>
                  )}
                  {u.approval_status !== "rejected" && (
                    <button onClick={() => decide(u, "rejected")} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "#ef444420", color: "#ef4444" }}>
                      {u.approval_status === "approved" ? "Revoke" : "Reject"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
