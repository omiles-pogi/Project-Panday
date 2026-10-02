import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  adminLogin,
  fetchStats,
  fetchUsers,
  getToken,
  logout,
  setApproval,
  setToken,
  UnauthorizedError,
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

const card = { background: "#1a1d27", border: "1px solid #2a2f42" };
const input = { background: "#252a3a", border: "1px solid #2a2f42", color: "#f0f2f5" };

export default function AdminApp() {
  const [authed, setAuthed] = useState(() => !!getToken());

  const signOut = useCallback(async () => {
    await logout();
    setToken(null);
    setAuthed(false);
  }, []);

  if (!authed) {
    return (
      <LoginView
        onLogin={(token) => {
          setToken(token);
          setAuthed(true);
        }}
      />
    );
  }
  return <Portal onSignOut={signOut} onExpired={() => { setToken(null); setAuthed(false); }} />;
}

function LoginView({ onLogin }: { onLogin: (token: string) => void }) {
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
    <div className="min-h-full flex items-center justify-center px-4" style={{ background: "#0a0c12" }}>
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl p-8" style={card}>
        <h1 className="text-2xl font-bold mb-1" style={{ color: "#f0f2f5" }}>Project-Panday Admin</h1>
        <p className="text-sm mb-6" style={{ color: "#6b7280" }}>Authorized administrator only.</p>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: "#9ca3af" }}>Email</label>
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-4"
          style={input}
        />
        <label className="block text-xs font-semibold mb-1.5" style={{ color: "#9ca3af" }}>Password</label>
        <div className="flex rounded-xl mb-4" style={input}>
          <input
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="flex-1 px-4 py-3 text-sm outline-none bg-transparent"
            style={{ color: "#f0f2f5" }}
          />
          <button type="button" onClick={() => setShow((s) => !s)} className="px-4 text-xs font-semibold" style={{ color: "#9ca3af" }}>
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

function Portal({ onSignOut, onExpired }: { onSignOut: () => void; onExpired: () => void }) {
  const [tab, setTab] = useState<"overview" | "accounts">("accounts");
  const [pending, setPending] = useState<number | null>(null);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof UnauthorizedError) onExpired();
    },
    [onExpired],
  );

  return (
    <div className="min-h-full" style={{ background: "#0a0c12" }}>
      <header className="flex items-center justify-between px-6 py-4" style={{ background: "#1a1d27", borderBottom: "1px solid #2a2f42" }}>
        <div className="flex items-center gap-6">
          <span className="font-bold" style={{ color: "#f0f2f5" }}>Project-Panday Admin</span>
          {(["accounts", "overview"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="text-sm font-semibold capitalize pb-0.5"
              style={{ color: tab === t ? "#f59e0b" : "#6b7280", borderBottom: tab === t ? "2px solid #f59e0b" : "2px solid transparent" }}
            >
              {t === "accounts" ? `Accounts${pending ? ` (${pending})` : ""}` : "Analytics"}
            </button>
          ))}
        </div>
        <button onClick={onSignOut} className="text-sm font-semibold" style={{ color: "#ef4444" }}>Sign out</button>
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

  useEffect(() => {
    fetchStats().then(setStats).catch(onError);
  }, [onError]);

  if (!stats) return <p style={{ color: "#6b7280" }}>Loading…</p>;
  const t = stats.totals;
  const maxSignup = Math.max(1, ...stats.signups.map((s) => s.total));
  const maxRole = Math.max(1, ...stats.by_role.map((r) => r.total));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Total users", value: t.users, color: "#f0f2f5" },
          { label: "Pending", value: t.pending, color: STATUS_COLOR.pending },
          { label: "Approved", value: t.approved, color: STATUS_COLOR.approved },
          { label: "Rejected", value: t.rejected, color: STATUS_COLOR.rejected },
          { label: "Active (7d)", value: t.active_7d, color: "#3b82f6" },
          { label: "New (7d)", value: t.new_7d, color: "#8b5cf6" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-4" style={card}>
            <div className="text-xs mb-1" style={{ color: "#6b7280" }}>{s.label}</div>
            <div className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="rounded-2xl p-5" style={card}>
          <h2 className="font-semibold text-sm mb-4" style={{ color: "#f0f2f5" }}>Users by role</h2>
          <div className="space-y-3">
            {stats.by_role.map((r) => (
              <div key={r.role}>
                <div className="flex justify-between text-xs mb-1" style={{ color: "#9ca3af" }}>
                  <span className="capitalize">{r.role}</span>
                  <span>{r.total}</span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "#252a3a" }}>
                  <div className="h-full rounded-full" style={{ width: `${(r.total / maxRole) * 100}%`, background: ROLE_COLOR[r.role] }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl p-5" style={card}>
          <h2 className="font-semibold text-sm mb-4" style={{ color: "#f0f2f5" }}>Sign-ups, last 14 days</h2>
          <div className="flex items-end gap-1.5" style={{ height: 140 }}>
            {stats.signups.map((s) => (
              <div key={s.date} className="flex-1 flex flex-col justify-end items-center h-full" title={`${s.date}: ${s.total}`}>
                <div className="text-[10px]" style={{ color: "#9ca3af" }}>{s.total || ""}</div>
                <div className="w-full rounded-t" style={{ height: `${(s.total / maxSignup) * 100}%`, minHeight: s.total ? 4 : 2, background: s.total ? "#f59e0b" : "#252a3a" }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] mt-2" style={{ color: "#6b7280" }}>
            <span>{stats.signups[0]?.date.slice(5)}</span>
            <span>{stats.signups[stats.signups.length - 1]?.date.slice(5)}</span>
          </div>
        </section>
      </div>
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
              style={{ background: status === f.value ? "#f59e0b20" : "transparent", color: status === f.value ? "#f59e0b" : "#9ca3af" }}
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
            <tr className="text-left text-xs" style={{ color: "#6b7280", borderBottom: "1px solid #2a2f42" }}>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Registered</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {users === null && (
              <tr><td colSpan={6} className="px-4 py-6 text-center" style={{ color: "#6b7280" }}>Loading…</td></tr>
            )}
            {users?.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center" style={{ color: "#6b7280" }}>No accounts match.</td></tr>
            )}
            {users?.map((u) => (
              <tr key={u.id} style={{ borderBottom: "1px solid #1e2235" }}>
                <td className="px-4 py-3 font-medium" style={{ color: "#f0f2f5" }}>{u.name}</td>
                <td className="px-4 py-3" style={{ color: "#9ca3af" }}>{u.email}</td>
                <td className="px-4 py-3 capitalize" style={{ color: ROLE_COLOR[u.role] }}>{u.role}</td>
                <td className="px-4 py-3" style={{ color: "#6b7280" }}>{new Date(u.created_at).toLocaleDateString()}</td>
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
