interface ProjectManagementProps {
  onNav: (s: string) => void;
}

const projects = [
  { name: "Dela Cruz Residence", homeowner: "Juan Dela Cruz", location: "Quezon City", budget: 2500000, spent: 1080000, start: "Mar 1, 2026", completion: "Nov 1, 2026", phase: "Structural Works", progress: 42, schedule: "behind" },
  { name: "Santos Commercial Bldg", homeowner: "Maria Santos", location: "Pasig City", budget: 4200000, spent: 2900000, start: "Jan 15, 2026", completion: "Dec 15, 2026", phase: "Finishing", progress: 68, schedule: "ahead" },
  { name: "Garcia Renovation", homeowner: "Pedro Garcia", location: "Makati", budget: 850000, spent: 210000, start: "Jul 1, 2026", completion: "Oct 31, 2026", phase: "Foundation", progress: 25, schedule: "behind" },
  { name: "Lim Two-Story House", homeowner: "Lucy Lim", location: "Marikina", budget: 3100000, spent: 2800000, start: "Nov 1, 2025", completion: "Sep 30, 2026", phase: "Final Finishing", progress: 90, schedule: "on-schedule" },
];

const sc: Record<string, { color: string; label: string }> = {
  "on-schedule": { color: "#10b981", label: "On Schedule" },
  ahead: { color: "#3b82f6", label: "Ahead" },
  behind: { color: "#f59e0b", label: "Behind" },
};

export default function ProjectManagement({ onNav }: ProjectManagementProps) {
  return (
    <div className="scroll-area">
      <div className="px-4 pt-4 pb-24 max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-700 mb-1" style={{ color: "#f0f2f5" }}>My Projects</h1>
          <p className="text-sm" style={{ color: "#6b7280" }}>All active and upcoming construction projects</p>
        </div>
      </div>

      <div className="space-y-5">
        {projects.map((p, i) => {
          const s = sc[p.schedule];
          const remBudget = p.budget - p.spent;
          return (
            <div key={i} className="rounded-xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <h2 className="font-700" style={{ color: "#f0f2f5" }}>{p.name}</h2>
                    <span className="px-2 py-0.5 rounded-full text-xs font-600" style={{ background: `${s.color}20`, color: s.color }}>{s.label}</span>
                  </div>
                  <p className="text-xs" style={{ color: "#6b7280" }}>Homeowner: {p.homeowner} · {p.location}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-700 mono" style={{ color: "#f59e0b" }}>{p.progress}%</div>
                  <div className="text-xs" style={{ color: "#6b7280" }}>Progress</div>
                </div>
              </div>

              <div className="h-2 rounded-full overflow-hidden mb-4" style={{ background: "#252a3a" }}>
                <div className="h-full rounded-full" style={{ width: `${p.progress}%`, background: `linear-gradient(90deg, ${s.color}cc, ${s.color})` }} />
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: "Start", value: p.start },
                  { label: "Target", value: p.completion },
                  { label: "Phase", value: p.phase },
                  { label: "Budget", value: `₱${(p.budget / 1000000).toFixed(1)}M` },
                  { label: "Spent", value: `₱${(p.spent / 1000000).toFixed(2)}M` },
                  { label: "Remaining", value: `₱${(remBudget / 1000000).toFixed(2)}M` },
                ].map(({ label, value }) => (
                  <div key={label} className="p-2.5 rounded-lg" style={{ background: "#252a3a" }}>
                    <div className="text-xs mb-0.5" style={{ color: "#6b7280" }}>{label}</div>
                    <div className="text-xs font-500 mono" style={{ color: "#f0f2f5" }}>{value}</div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 flex-wrap">
                <button onClick={() => onNav("progress-report")} className="px-3 py-1.5 rounded-lg text-xs font-600" style={{ background: "#f59e0b", color: "#0f1117" }}>Update Progress</button>
                <button className="px-3 py-1.5 rounded-lg text-xs font-500" style={{ background: "#252a3a", color: "#9ca3af" }}>Add Expense</button>
                <button className="px-3 py-1.5 rounded-lg text-xs font-500" style={{ background: "#252a3a", color: "#9ca3af" }}>Upload Photos</button>
                <button onClick={() => onNav("progress-analysis")} className="px-3 py-1.5 rounded-lg text-xs font-500" style={{ background: "#252a3a", color: "#9ca3af" }}>AI Analysis</button>
                <button className="px-3 py-1.5 rounded-lg text-xs font-500" style={{ background: "#252a3a", color: "#9ca3af" }}>View Schedule</button>
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
