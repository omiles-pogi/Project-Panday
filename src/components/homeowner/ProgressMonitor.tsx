const phases = [
  { name: "Foundation", pct: 100, status: "complete" },
  { name: "Structural Works", pct: 80, status: "active" },
  { name: "Walls & Masonry", pct: 60, status: "active" },
  { name: "Roofing", pct: 30, status: "active" },
  { name: "Electrical Works", pct: 10, status: "started" },
  { name: "Plumbing", pct: 10, status: "started" },
  { name: "Finishing", pct: 0, status: "pending" },
];

const weeklyData = [
  { week: "Wk 1", expected: 8, actual: 9 },
  { week: "Wk 2", expected: 15, actual: 16 },
  { week: "Wk 3", expected: 23, actual: 22 },
  { week: "Wk 4", expected: 33, actual: 30 },
  { week: "Wk 5", expected: 40, actual: 37 },
  { week: "Wk 6", expected: 48, actual: 42 },
];

const milestones = [
  { name: "Project Kickoff", date: "Mar 1, 2026", done: true },
  { name: "Foundation Complete", date: "Apr 15, 2026", done: true },
  { name: "Structural Frame", date: "May 30, 2026", done: true },
  { name: "Roof Done", date: "Jul 15, 2026", done: false },
  { name: "MEP Complete", date: "Sep 1, 2026", done: false },
  { name: "Project Handover", date: "Nov 1, 2026", done: false },
];

export default function ProgressMonitor() {
  const overall = 42;
  const expected = 48;

  return (
    <div className="scroll-area">
      <div className="px-4 pt-4 pb-24 max-w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-700 mb-1" style={{ color: "#f0f2f5" }}>Progress Monitor</h1>
            <p className="text-sm" style={{ color: "#6b7280" }}>My House Construction · Real-time progress tracking</p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-600" style={{ background: "#f59e0b20", color: "#f59e0b" }}>⚠ Behind Schedule</span>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-5">
          {/* Circular progress */}
          <div className="rounded-xl p-5 flex flex-col items-center justify-center" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
            <div className="relative w-32 h-32 mb-4">
              <svg viewBox="0 0 36 36" className="w-32 h-32 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#252a3a" strokeWidth="2.5" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#374151" strokeWidth="2.5" strokeDasharray={`${expected} ${100 - expected}`} strokeLinecap="round" strokeDashoffset="0" opacity="0.5" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray={`${overall} ${100 - overall}`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-800" style={{ color: "#f0f2f5" }}>{overall}%</span>
                <span className="text-xs" style={{ color: "#6b7280" }}>Actual</span>
              </div>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-2 justify-center mb-1">
                <div className="w-2 h-2 rounded-full" style={{ background: "#f59e0b" }} />
                <span className="text-xs" style={{ color: "#9ca3af" }}>Actual: {overall}%</span>
              </div>
              <div className="flex items-center gap-2 justify-center">
                <div className="w-2 h-2 rounded-full opacity-50" style={{ background: "#374151" }} />
                <span className="text-xs" style={{ color: "#9ca3af" }}>Expected: {expected}%</span>
              </div>
            </div>
          </div>

          {/* Phase breakdown */}
          <div className="rounded-xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
            <h2 className="font-600 text-sm mb-4" style={{ color: "#f0f2f5" }}>Construction Phases</h2>
            <div className="space-y-3">
              {phases.map(({ name, pct, status }) => (
                <div key={name}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: status === "complete" ? "#10b981" : status === "active" ? "#f59e0b" : status === "started" ? "#3b82f6" : "#374151" }} />
                      <span style={{ color: "#9ca3af" }}>{name}</span>
                    </div>
                    <span className="mono font-600" style={{ color: pct === 100 ? "#10b981" : pct > 0 ? "#f59e0b" : "#374151" }}>{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "#252a3a" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct === 100 ? "#10b981" : pct > 50 ? "#f59e0b" : pct > 0 ? "#3b82f6" : "#252a3a" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Weekly chart */}
        <div className="rounded-xl p-5 mb-6" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <h2 className="font-600 text-sm mb-1" style={{ color: "#f0f2f5" }}>Weekly Progress — Expected vs Actual</h2>
          <p className="text-xs mb-4" style={{ color: "#6b7280" }}>Week-by-week cumulative progress comparison</p>
          <div className="relative" style={{ height: 180 }}>
            <div className="absolute inset-0 flex items-end justify-around gap-2 pb-6">
              {weeklyData.map(({ week, expected, actual }) => (
                <div key={week} className="flex flex-col items-center gap-1 flex-1">
                  <div className="w-full flex gap-1 items-end" style={{ height: 130 }}>
                    <div className="flex-1 rounded-t-sm transition-all" style={{ height: `${(expected / 50) * 100}%`, background: "#37415160", minWidth: 8 }} title={`Expected: ${expected}%`} />
                    <div className="flex-1 rounded-t-sm transition-all" style={{ height: `${(actual / 50) * 100}%`, background: actual < expected ? "#f59e0b" : "#10b981", minWidth: 8 }} title={`Actual: ${actual}%`} />
                  </div>
                  <span className="text-xs mono" style={{ color: "#6b7280" }}>{week}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ background: "#37415160" }} /><span className="text-xs" style={{ color: "#9ca3af" }}>Expected</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ background: "#f59e0b" }} /><span className="text-xs" style={{ color: "#9ca3af" }}>Actual</span></div>
          </div>

          <div className="mt-4 p-3 rounded-lg" style={{ background: "#f59e0b15", borderLeft: "3px solid #f59e0b" }}>
            <p className="text-sm" style={{ color: "#fbbf24" }}>
              <strong>🤖 AI Analysis:</strong> Project is 6% behind expected progress. Current trend suggests possible 2-week delay. Consider adding resources to roofing and MEP phases to recover schedule.
            </p>
          </div>
        </div>

        {/* Milestones */}
        <div className="rounded-xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <h2 className="font-600 text-sm mb-4" style={{ color: "#f0f2f5" }}>Project Milestones</h2>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px" style={{ background: "#2a2f42" }} />
            <div className="space-y-4">
              {milestones.map(({ name, date, done }, i) => (
                <div key={i} className="flex items-center gap-4 pl-10 relative">
                  <div className="absolute left-0 w-8 h-8 rounded-full flex items-center justify-center text-sm border-2" style={{ background: done ? "#10b981" : "#252a3a", borderColor: done ? "#10b981" : "#374151", color: done ? "#fff" : "#6b7280" }}>
                    {done ? "✓" : i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-500 text-sm" style={{ color: done ? "#f0f2f5" : "#9ca3af" }}>{name}</div>
                    <div className="text-xs" style={{ color: "#6b7280" }}>{date}</div>
                  </div>
                  {done && <span className="text-xs font-500" style={{ color: "#10b981" }}>COMPLETE</span>}
                  {!done && i === 3 && <span className="text-xs font-500" style={{ color: "#f59e0b" }}>IN PROGRESS</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
