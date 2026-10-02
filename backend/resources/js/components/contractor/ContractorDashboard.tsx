interface ContractorDashboardProps { onNav: (s: string) => void }

const projects = [
  { name: "Dela Cruz Residence", location: "Quezon City", progress: 42, status: "behind", phase: "Structural Works" },
  { name: "Santos Commercial", location: "Pasig City", progress: 68, status: "ahead", phase: "Finishing" },
  { name: "Garcia Renovation", location: "Makati", progress: 25, status: "behind", phase: "Foundation" },
  { name: "Lim Two-Story House", location: "Marikina", progress: 90, status: "on-schedule", phase: "Final Finishing" },
];

const sc: Record<string, { color: string; label: string }> = {
  "on-schedule": { color: "#10b981", label: "On Schedule" },
  ahead: { color: "#3b82f6", label: "Ahead" },
  behind: { color: "#f59e0b", label: "Behind" },
};

export default function ContractorDashboard({ onNav }: ContractorDashboardProps) {
  return (
    <div className="scroll-area">
      <div className="px-4 pt-4 pb-24 space-y-4">

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Active Projects", value: "4", color: "#f59e0b", icon: "🏗️" },
            { label: "Completed", value: "127", color: "#10b981", icon: "✓" },
            { label: "Workers Available", value: "18/45", color: "#3b82f6", icon: "👷" },
            { label: "Pending Payments", value: "₱420K", color: "#8b5cf6", icon: "₱" },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className="p-4 rounded-3xl" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
              <div className="text-2xl mb-2">{icon}</div>
              <div className="text-xl font-800 mono mb-0.5" style={{ color }}>{value}</div>
              <div className="text-xs" style={{ color: "#6b7280" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* AI Alert */}
        <div className="rounded-3xl p-4" style={{ background: "#f59e0b12", border: "1px solid #f59e0b30" }}>
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0">🤖</span>
            <div>
              <div className="font-700 text-sm mb-1" style={{ color: "#f59e0b" }}>AI CAPACITY ALERT</div>
              <p className="text-xs leading-relaxed" style={{ color: "#fbbf24" }}>You have 4 active projects. Accepting a new project may exceed your equipment and workforce capacity.</p>
              <button onClick={() => onNav("capacity-monitor")} className="mt-2 text-xs font-600" style={{ color: "#f59e0b" }}>Review Capacity →</button>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Browse", icon: "📋", id: "available-projects" },
            { label: "Report", icon: "📝", id: "progress-report" },
            { label: "Schedule", icon: "📅", id: "equipment-schedule" },
            { label: "Analysis", icon: "📈", id: "progress-analysis" },
          ].map(({ label, icon, id }) => (
            <button key={id} onClick={() => onNav(id)} className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl active:scale-[0.95]" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
              <span className="text-2xl">{icon}</span>
              <span className="text-xs font-600" style={{ color: "#9ca3af" }}>{label}</span>
            </button>
          ))}
        </div>

        {/* Active projects */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-700 text-sm" style={{ color: "#f0f2f5" }}>Active Projects</h2>
            <button onClick={() => onNav("project-management")} className="text-xs font-600" style={{ color: "#f59e0b" }}>View All →</button>
          </div>
          <div className="space-y-3">
            {projects.map((p, i) => {
              const s = sc[p.status];
              return (
                <div key={i} className="rounded-3xl p-4" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-700 text-sm mb-0.5" style={{ color: "#f0f2f5" }}>{p.name}</div>
                      <div className="text-xs" style={{ color: "#6b7280" }}>{p.location} · {p.phase}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-800 mono text-base" style={{ color: s.color }}>{p.progress}%</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-600" style={{ background: s.color + "20", color: s.color }}>{s.label}</span>
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden mb-3" style={{ background: "#252a3a" }}>
                    <div className="h-full rounded-full" style={{ width: `${p.progress}%`, background: s.color }} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => onNav("progress-report")} className="flex-1 py-2 rounded-xl text-xs font-600" style={{ background: "#f59e0b", color: "#0f1117" }}>Submit Report</button>
                    <button className="px-4 py-2 rounded-xl text-xs font-500" style={{ background: "#252a3a", color: "#9ca3af" }}>Details</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Worker allocation */}
        <div className="rounded-3xl p-4" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <h2 className="font-700 text-sm mb-3" style={{ color: "#f0f2f5" }}>Worker Allocation</h2>
          <div className="space-y-3">
            {[
              { role: "Foreman", total: 2, busy: 2 },
              { role: "Carpenter", total: 10, busy: 8 },
              { role: "Mason", total: 8, busy: 7 },
              { role: "Laborer", total: 21, busy: 18 },
            ].map(({ role, total, busy }) => (
              <div key={role}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span style={{ color: "#9ca3af" }}>{role}</span>
                  <span className="mono" style={{ color: busy === total ? "#ef4444" : "#6b7280" }}>{busy}/{total}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "#252a3a" }}>
                  <div className="h-full rounded-full" style={{ width: `${(busy / total) * 100}%`, background: busy === total ? "#ef4444" : busy / total > 0.7 ? "#f59e0b" : "#10b981" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
