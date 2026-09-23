const weeklyData = [
  { week: "Week 1", expected: 8, actual: 9 },
  { week: "Week 2", expected: 15, actual: 16 },
  { week: "Week 3", expected: 23, actual: 22 },
  { week: "Week 4", expected: 33, actual: 30 },
  { week: "Week 5", expected: 40, actual: 37 },
  { week: "Week 6", expected: 48, actual: 42 },
];

const maxVal = 55;

export default function WeeklyAnalytics() {
  return (
    <div className="scroll-area">
      <div className="px-4 pt-4 pb-24 max-w-full">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-600 px-2 py-0.5 rounded-full" style={{ background: "#f59e0b20", color: "#f59e0b" }}>🤖 AI ANALYTICS</span>
          </div>
          <h1 className="text-2xl font-700 mb-1" style={{ color: "#f0f2f5" }}>Weekly Progress Analytics</h1>
          <p className="text-sm" style={{ color: "#6b7280" }}>Dela Cruz Residence · Cumulative progress comparison</p>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Current Week", value: "Week 6", sub: "Of 32 weeks" },
            { label: "On-time Rate", value: "67%", sub: "Weeks on target", color: "#f59e0b" },
            { label: "Avg Weekly Progress", value: "7%", sub: "Actual per week" },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="p-4 rounded-xl" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
              <div className="text-xs mb-1" style={{ color: "#6b7280" }}>{label}</div>
              <div className="text-2xl font-700 mono" style={{ color: color || "#f0f2f5" }}>{value}</div>
              <div className="text-xs mt-0.5" style={{ color: "#6b7280" }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="rounded-xl p-5 mb-6" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-600 text-sm" style={{ color: "#f0f2f5" }}>Cumulative Progress — Expected vs Actual</h2>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5"><div className="w-3 h-1" style={{ background: "#374151" }} /><span className="text-xs" style={{ color: "#6b7280" }}>Expected</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-1" style={{ background: "#f59e0b" }} /><span className="text-xs" style={{ color: "#6b7280" }}>Actual</span></div>
            </div>
          </div>

          {/* Y-axis labels + bars */}
          <div className="flex gap-2" style={{ height: 220 }}>
            {/* Y axis */}
            <div className="flex flex-col justify-between text-right pr-2 pb-6" style={{ width: 36 }}>
              {[50, 40, 30, 20, 10, 0].map(v => (
                <span key={v} className="text-xs mono" style={{ color: "#374151" }}>{v}%</span>
              ))}
            </div>
            {/* Grid + bars */}
            <div className="flex-1 relative">
              {/* Grid lines */}
              {[0, 20, 40, 60, 80, 100].map(pct => (
                <div key={pct} className="absolute w-full border-t" style={{ bottom: `${pct}%`, borderColor: "#1e2235", height: 0 }} />
              ))}
              {/* Bars */}
              <div className="absolute inset-0 pb-6 flex items-end gap-3">
                {weeklyData.map(({ week, expected, actual }) => {
                  const ahead = actual >= expected;
                  return (
                    <div key={week} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex gap-1 items-end" style={{ height: "100%" }}>
                        <div className="flex-1 rounded-t-sm" style={{ height: `${(expected / maxVal) * 100}%`, background: "#37415150" }} title={`Expected: ${expected}%`} />
                        <div className="flex-1 rounded-t-sm" style={{ height: `${(actual / maxVal) * 100}%`, background: ahead ? "#10b981" : "#f59e0b" }} title={`Actual: ${actual}%`} />
                      </div>
                      <span className="text-xs whitespace-nowrap" style={{ color: "#6b7280" }}>{week}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Data table below chart */}
          <div className="mt-6 space-y-1.5">
            {weeklyData.map(({ week, expected, actual }) => {
              const gap = actual - expected;
              const onTime = gap >= 0;
              return (
                <div key={week} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "#252a3a" }}>
                  <span className="text-xs font-600 w-12 flex-shrink-0" style={{ color: "#9ca3af" }}>{week}</span>
                  <div className="flex gap-3 flex-1 text-xs mono">
                    <span style={{ color: "#374151" }}>Exp: {expected}%</span>
                    <span style={{ color: onTime ? "#10b981" : "#f59e0b" }}>Act: {actual}%</span>
                    <span style={{ color: gap >= 0 ? "#10b981" : "#f59e0b" }}>({gap >= 0 ? "+" : ""}{gap}%)</span>
                  </div>
                  <span className="text-xs font-500 flex-shrink-0" style={{ color: onTime ? "#10b981" : "#f59e0b" }}>
                    {onTime ? "✓ On Track" : "Behind"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Status */}
        <div className="rounded-xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <h2 className="font-600 text-sm mb-3" style={{ color: "#f0f2f5" }}>🤖 AI Weekly Analysis</h2>
          <p className="text-sm leading-relaxed" style={{ color: "#9ca3af" }}>
            The project started strong in Weeks 1–2, achieving above-expected progress. Starting Week 3, actual progress began lagging behind expected rates. The current 6% cumulative gap suggests that if the current trend continues, the project may experience a 2–3 week total delay. The upcoming Structural Works phase is critical — resource addition is recommended.
          </p>
        </div>
      </div>
    </div>
  );
}
