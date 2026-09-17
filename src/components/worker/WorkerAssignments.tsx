import { useState } from "react";

const assignments = [
  {
    project: "Dela Cruz Residence",
    location: "Quezon City",
    phase: "Structural Works",
    role: "Mason",
    startDate: "Mar 1, 2026",
    endDate: "Nov 1, 2026",
    dailyRate: 850,
    status: "active",
    supervisor: "Ricardo Gomez (Foreman)",
    tasks: [
      { task: "Form removal — 2nd floor columns", date: "Sep 7, 2026", status: "in-progress" },
      { task: "Masonry — east wall block laying", date: "Sep 7, 2026", status: "pending" },
      { task: "CHB wall laying — north section", date: "Sep 6, 2026", status: "done" },
      { task: "Mortar mixing — main batch", date: "Sep 5, 2026", status: "done" },
    ],
  },
  {
    project: "Santos Commercial Building",
    location: "Pasig City",
    phase: "Finishing",
    role: "Mason",
    startDate: "Aug 1, 2026",
    endDate: "Sep 5, 2026",
    dailyRate: 850,
    status: "completed",
    supervisor: "Jun Reyes (Foreman)",
    tasks: [],
  },
];

const statusStyle: Record<string, { color: string; bg: string; label: string }> = {
  active: { color: "#10b981", bg: "#10b98120", label: "Active" },
  completed: { color: "#6b7280", bg: "#25253a", label: "Completed" },
  upcoming: { color: "#3b82f6", bg: "#3b82f620", label: "Upcoming" },
  "in-progress": { color: "#3b82f6", bg: "#3b82f620", label: "In Progress" },
  pending: { color: "#f59e0b", bg: "#f59e0b20", label: "Pending" },
  done: { color: "#10b981", bg: "#10b98120", label: "Done" },
};

export default function WorkerAssignments() {
  const [expanded, setExpanded] = useState<number | null>(0);

  return (
    <div className="scroll-area">
      <div className="px-4 pt-4 pb-24 max-w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-700 mb-1" style={{ color: "#f0f2f5" }}>My Assignments</h1>
          <p className="text-sm" style={{ color: "#6b7280" }}>Marco Aquino · Mason · All project assignments</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Active Assignments", value: "1", color: "#10b981" },
            { label: "Completed Projects", value: "8", color: "#6b7280" },
            { label: "Total Days Worked", value: "142", color: "#f59e0b" },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-4 rounded-xl text-center" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
              <div className="text-xs mb-1" style={{ color: "#6b7280" }}>{label}</div>
              <div className="text-2xl font-700" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {assignments.map((a, i) => {
            const s = statusStyle[a.status];
            const isOpen = expanded === i;
            return (
              <div key={i} className="rounded-xl overflow-hidden" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
                <button className="w-full p-5 text-left" onClick={() => setExpanded(isOpen ? null : i)}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="font-700" style={{ color: "#f0f2f5" }}>{a.project}</h2>
                        <span className="px-2 py-0.5 rounded-full text-xs font-600" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                      </div>
                      <p className="text-xs" style={{ color: "#6b7280" }}>{a.location} · {a.phase} · Role: <span style={{ color: "#f59e0b" }}>{a.role}</span></p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-600 mono text-sm" style={{ color: "#f0f2f5" }}>₱{a.dailyRate.toLocaleString()}/day</div>
                      <div className="text-xs" style={{ color: "#6b7280" }}>{a.startDate} – {a.endDate}</div>
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 border-t" style={{ borderColor: "#2a2f42" }}>
                    <div className="pt-4 mb-4">
                      <div className="text-xs mb-1" style={{ color: "#6b7280" }}>Supervisor</div>
                      <div className="text-sm font-500" style={{ color: "#9ca3af" }}>{a.supervisor}</div>
                    </div>
                    {a.tasks.length > 0 && (
                      <>
                        <div className="text-xs font-600 mb-3" style={{ color: "#9ca3af" }}>TASK LIST</div>
                        <div className="space-y-2">
                          {a.tasks.map((t, j) => {
                            const ts = statusStyle[t.status];
                            return (
                              <div key={j} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: "#252a3a" }}>
                                <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0" style={{ background: ts.bg, color: ts.color }}>
                                  {t.status === "done" ? "✓" : t.status === "in-progress" ? "▶" : "○"}
                                </div>
                                <span className="flex-1 text-sm" style={{ color: t.status === "done" ? "#6b7280" : "#f0f2f5", textDecoration: t.status === "done" ? "line-through" : "none" }}>{t.task}</span>
                                <span className="text-xs" style={{ color: "#6b7280" }}>{t.date}</span>
                                <span className="px-2 py-0.5 rounded text-xs font-500" style={{ background: ts.bg, color: ts.color }}>{ts.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
