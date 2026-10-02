interface DashboardProps { onNav: (s: string) => void }

const phases = [
  { name: "Foundation", pct: 100 },
  { name: "Structural Works", pct: 80 },
  { name: "Walls", pct: 60 },
  { name: "Roofing", pct: 30 },
  { name: "Electrical", pct: 10 },
  { name: "Plumbing", pct: 10 },
  { name: "Finishing", pct: 0 },
];

const notifications = [
  { type: "warning", msg: "3 items pending your approval." },
  { type: "info", msg: "AI recommendation ready for structural phase review." },
  { type: "success", msg: "Foundation phase completed ahead of schedule." },
];

export default function HomeownerDashboard({ onNav }: DashboardProps) {
  const budget = 2500000, spent = 1080000, projected = 2420000;
  const remaining = budget - spent;
  const pct = 42;

  return (
    <div className="scroll-area" style={{ background: "#0f1117" }}>
      <div className="px-4 pt-4 pb-24 space-y-4">

        {/* Hero project card */}
        <div className="rounded-3xl p-5" style={{ background: "linear-gradient(135deg, #1a1d27, #252a3a)", border: "1px solid #2a2f42" }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-700 px-2 py-0.5 rounded-full" style={{ background: "#10b98120", color: "#10b981" }}>ACTIVE</span>
              </div>
              <h2 className="text-lg font-800" style={{ color: "#f0f2f5" }}>My House Construction</h2>
              <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>Quezon City · Started Mar 1, 2026</p>
            </div>
            {/* Circular progress */}
            <div className="relative w-16 h-16 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#252a3a" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f59e0b" strokeWidth="3"
                  strokeDasharray={`${pct} ${100 - pct}`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-800" style={{ color: "#f0f2f5" }}>{pct}%</span>
              </div>
            </div>
          </div>

          {/* Budget pills */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { label: "Budget", value: "₱2.5M", color: "#9ca3af" },
              { label: "Spent", value: "₱1.08M", color: "#f59e0b" },
              { label: "Remaining", value: "₱1.42M", color: "#10b981" },
              { label: "Projected", value: "₱2.42M", color: "#3b82f6" },
            ].map(({ label, value, color }) => (
              <div key={label} className="px-3 py-2.5 rounded-2xl" style={{ background: "#0f111788" }}>
                <div className="text-xs mb-0.5" style={{ color: "#6b7280" }}>{label}</div>
                <div className="font-700 text-sm mono" style={{ color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-xs mb-1.5" style={{ color: "#6b7280" }}>
              <span>Overall Progress</span>
              <span style={{ color: "#10b981" }}>ON SCHEDULE</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "#252a3a" }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #f59e0b, #fbbf24)" }} />
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "AI Plan", icon: "🤖", id: "create-project" },
            { label: "Budget", icon: "₱", id: "budget-monitor" },
            { label: "Progress", icon: "📊", id: "progress" },
            { label: "Approvals", icon: "✓", id: "approvals" },
          ].map(({ label, icon, id }) => (
            <button key={id} onClick={() => onNav(id)} className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl transition-all active:scale-[0.95]" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
              <span className="text-2xl">{icon}</span>
              <span className="text-xs font-600" style={{ color: "#9ca3af" }}>{label}</span>
            </button>
          ))}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Active", value: "1", color: "#f59e0b" },
            { label: "Completed", value: "2", color: "#10b981" },
            { label: "Pending", value: "3", color: "#ef4444" },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-4 rounded-2xl text-center" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
              <div className="text-2xl font-800 mb-0.5" style={{ color }}>{value}</div>
              <div className="text-xs" style={{ color: "#6b7280" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Construction phases */}
        <div className="rounded-3xl p-4" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-700 text-sm" style={{ color: "#f0f2f5" }}>Construction Phases</h3>
            <button onClick={() => onNav("progress")} className="text-xs font-600" style={{ color: "#f59e0b" }}>View All →</button>
          </div>
          <div className="space-y-3">
            {phases.map(({ name, pct }) => (
              <div key={name}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span style={{ color: "#9ca3af" }}>{name}</span>
                  <span className="mono font-600" style={{ color: pct === 100 ? "#10b981" : pct > 0 ? "#f59e0b" : "#374151" }}>{pct}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "#252a3a" }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? "#10b981" : pct > 50 ? "#f59e0b" : pct > 0 ? "#3b82f6" : "#252a3a" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded-3xl p-4" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <h3 className="font-700 text-sm mb-3" style={{ color: "#f0f2f5" }}>Notifications</h3>
          <div className="space-y-2.5">
            {notifications.map(({ type, msg }, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-2xl" style={{ background: "#252a3a" }}>
                <span className="text-base flex-shrink-0">{type === "warning" ? "⚠️" : type === "info" ? "ℹ️" : "✅"}</span>
                <p className="text-xs leading-relaxed" style={{ color: "#9ca3af" }}>{msg}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Budget overview */}
        <div className="rounded-3xl p-4" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-700 text-sm" style={{ color: "#f0f2f5" }}>Budget Overview</h3>
            <button onClick={() => onNav("budget-monitor")} className="text-xs font-600" style={{ color: "#f59e0b" }}>Details →</button>
          </div>
          <div className="h-3 rounded-full overflow-hidden flex mb-2" style={{ background: "#252a3a" }}>
            <div style={{ width: `${(spent / budget) * 100}%`, background: "#f59e0b" }} className="h-full" />
            <div style={{ width: `${((projected - spent) / budget) * 100}%`, background: "#f59e0b40" }} className="h-full" />
          </div>
          <div className="flex justify-between text-xs" style={{ color: "#6b7280" }}>
            <span>Spent: <span className="mono font-600" style={{ color: "#f59e0b" }}>₱{spent.toLocaleString()}</span></span>
            <span>Projected: <span className="mono font-600" style={{ color: "#3b82f6" }}>₱{projected.toLocaleString()}</span></span>
          </div>
        </div>

      </div>
    </div>
  );
}
