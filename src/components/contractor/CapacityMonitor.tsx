export default function CapacityMonitor() {
  return (
    <div className="scroll-area">
      <div className="px-4 pt-4 pb-24 max-w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-700 mb-1" style={{ color: "#f0f2f5" }}>AI Capacity Monitor</h1>
          <p className="text-sm" style={{ color: "#6b7280" }}>AI evaluation before accepting Reyes Family Residence project</p>
        </div>

        {/* AI Alert */}
        <div className="rounded-xl p-6 mb-6" style={{ background: "#f59e0b15", border: "2px solid #f59e0b40" }}>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: "#f59e0b20" }}>🤖</div>
            <div>
              <div className="font-700 mb-2 text-base" style={{ color: "#f59e0b" }}>AI CAPACITY ALERT</div>
              <p className="text-sm leading-relaxed" style={{ color: "#fbbf24" }}>
                You currently have <strong>4 active projects</strong>. Accepting the Reyes Family Residence project may exceed your estimated construction capacity. Your workforce utilization is at 89% and concrete mixers are 66% allocated. Consider your equipment conflict on September 12–14 before accepting.
              </p>
            </div>
          </div>
        </div>

        {/* Capacity grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Current Capacity", value: "89%", color: "#f59e0b", sub: "Workforce deployed" },
            { label: "Available Capacity", value: "11%", color: "#ef4444", sub: "Remaining" },
            { label: "Active Projects", value: "4", color: "#f0f2f5", sub: "In progress" },
            { label: "Upcoming Projects", value: "2", color: "#3b82f6", sub: "Scheduled" },
          ].map(({ label, value, color, sub }) => (
            <div key={label} className="p-4 rounded-xl text-center" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
              <div className="text-xs mb-1" style={{ color: "#6b7280" }}>{label}</div>
              <div className="text-2xl font-700 mb-0.5" style={{ color }}>{value}</div>
              <div className="text-xs" style={{ color: "#6b7280" }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Equipment conflicts */}
        <div className="rounded-xl p-5 mb-6" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <h2 className="font-600 text-sm mb-4" style={{ color: "#f0f2f5" }}>Equipment Conflict Detection</h2>
          <div className="rounded-xl p-4 mb-4" style={{ background: "#ef444415", border: "1px solid #ef444440" }}>
            <div className="flex items-start gap-3">
              <span>⚠️</span>
              <div>
                <div className="font-600 text-sm mb-1" style={{ color: "#ef4444" }}>AI EQUIPMENT CONFLICT</div>
                <p className="text-sm" style={{ color: "#fca5a5" }}>
                  <strong>Concrete Mixer A</strong> is assigned to Garcia Renovation from September 10–15, but the Reyes Family Residence project requires it from September 12–14.
                </p>
                <p className="text-sm mt-2" style={{ color: "#9ca3af" }}>
                  <strong>🤖 AI Recommendation:</strong> Reschedule Reyes start to September 16 or rent an additional mixer for the conflict period (~₱3,000/day).
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {[
              { equipment: "Concrete Mixer A", project: "Garcia Renovation", dates: "Sep 10–15", conflict: true },
              { equipment: "Concrete Mixer B", project: "Dela Cruz Residence", dates: "Sep 8–20", conflict: false },
              { equipment: "Concrete Mixer C", project: "Available", dates: "—", conflict: false },
              { equipment: "Scaffolding Set A", project: "Santos Commercial", dates: "Sep 1–30", conflict: false },
            ].map(({ equipment, project, dates, conflict }) => (
              <div key={equipment} className="flex items-center justify-between px-4 py-3 rounded-lg" style={{ background: conflict ? "#ef444415" : "#252a3a", border: conflict ? "1px solid #ef444430" : "1px solid transparent" }}>
                <span className="text-sm" style={{ color: "#f0f2f5" }}>{equipment}</span>
                <span className="text-xs" style={{ color: "#9ca3af" }}>{project}</span>
                <span className="text-xs mono" style={{ color: "#6b7280" }}>{dates}</span>
                {conflict && <span className="text-xs font-600" style={{ color: "#ef4444" }}>⚡ CONFLICT</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Workforce capacity */}
        <div className="rounded-xl p-5 mb-6" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <h2 className="font-600 text-sm mb-4" style={{ color: "#f0f2f5" }}>Workforce Capacity</h2>
          <div className="space-y-3">
            {[
              { role: "Foreman", total: 2, used: 2, needed: 1 },
              { role: "Carpenter", total: 10, used: 8, needed: 3 },
              { role: "Mason", total: 8, used: 7, needed: 3 },
              { role: "Laborer", total: 21, used: 18, needed: 8 },
            ].map(({ role, total, used, needed }) => {
              const avail = total - used;
              const ok = avail >= needed;
              return (
                <div key={role}>
                  <div className="flex justify-between text-xs mb-1" style={{ color: "#9ca3af" }}>
                    <span>{role}</span>
                    <span className={ok ? "" : ""} style={{ color: ok ? "#10b981" : "#ef4444" }}>
                      {avail} available · {needed} needed {ok ? "✓" : "⚠ Shortage"}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "#252a3a" }}>
                    <div className="h-full rounded-full" style={{ width: `${(used / total) * 100}%`, background: used === total ? "#ef4444" : "#f59e0b" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Decision */}
        <div className="rounded-xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <h2 className="font-600 text-sm mb-2" style={{ color: "#f0f2f5" }}>Your Decision</h2>
          <p className="text-xs mb-4" style={{ color: "#6b7280" }}>The AI has flagged capacity concerns. The final decision is yours as the contractor.</p>
          <div className="flex gap-3">
            <button className="px-5 py-2.5 rounded-lg text-sm font-500" style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42" }}>Review Capacity</button>
            <button className="px-5 py-2.5 rounded-lg text-sm font-600 hover:opacity-90" style={{ background: "#10b98120", color: "#10b981" }}>Accept Anyway</button>
            <button className="px-5 py-2.5 rounded-lg text-sm font-600 hover:opacity-90" style={{ background: "#ef444420", color: "#ef4444" }}>Decline Project</button>
          </div>
        </div>
      </div>
    </div>
  );
}
