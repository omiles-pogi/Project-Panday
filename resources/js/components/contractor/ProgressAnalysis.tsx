export default function ProgressAnalysis() {
  const previous = 34;
  const newWork = 8;
  const current = 42;
  const expected = 48;
  const diff = current - expected;

  return (
    <div className="scroll-area">
      <div className="px-4 pt-4 pb-24 max-w-full">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-600 px-2 py-0.5 rounded-full" style={{ background: "#f59e0b20", color: "#f59e0b" }}>🤖 AI ANALYSIS</span>
          </div>
          <h1 className="text-2xl font-700 mb-1" style={{ color: "#f0f2f5" }}>AI Progress Analysis</h1>
          <p className="text-sm" style={{ color: "#6b7280" }}>Dela Cruz Residence · Analysis generated Sep 6, 2026</p>
        </div>

        {/* Status banner */}
        <div className="rounded-xl p-5 mb-6" style={{ background: "#f59e0b15", border: "2px solid #f59e0b40" }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-800" style={{ color: "#f59e0b" }}>Slightly Behind Schedule</div>
              <p className="text-sm mt-1" style={{ color: "#fbbf24" }}>Current progress is {Math.abs(diff)}% below expected. Recovery is achievable with resource optimization.</p>
            </div>
            <div className="text-6xl opacity-50">📊</div>
          </div>
        </div>

        {/* Progress cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Previous Progress", value: `${previous}%`, color: "#6b7280" },
            { label: "New Work Completed", value: `+${newWork}%`, color: "#3b82f6" },
            { label: "Current Progress", value: `${current}%`, color: "#f59e0b" },
            { label: "Expected Progress", value: `${expected}%`, color: "#10b981" },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-4 rounded-xl text-center" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
              <div className="text-xs mb-1" style={{ color: "#6b7280" }}>{label}</div>
              <div className="text-2xl font-700 mono" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Visual comparison */}
        <div className="rounded-xl p-5 mb-6" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <h2 className="font-600 text-sm mb-4" style={{ color: "#f0f2f5" }}>Expected vs Actual Progress</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span style={{ color: "#9ca3af" }}>Expected Progress</span>
                <span className="mono font-600" style={{ color: "#10b981" }}>{expected}%</span>
              </div>
              <div className="h-4 rounded-full overflow-hidden" style={{ background: "#252a3a" }}>
                <div className="h-full rounded-full" style={{ width: `${expected}%`, background: "#37415180" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span style={{ color: "#9ca3af" }}>Actual Progress</span>
                <span className="mono font-600" style={{ color: "#f59e0b" }}>{current}%</span>
              </div>
              <div className="h-4 rounded-full overflow-hidden" style={{ background: "#252a3a" }}>
                <div className="h-full rounded-full" style={{ width: `${current}%`, background: "linear-gradient(90deg, #f59e0b, #fbbf24)" }} />
              </div>
            </div>
          </div>
          <div className="mt-3 text-xs" style={{ color: "#6b7280" }}>Gap: <span style={{ color: "#f59e0b" }}>{Math.abs(diff)}% behind</span> expected schedule</div>
        </div>

        {/* AI Classification */}
        <div className="rounded-xl p-5 mb-6" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <h2 className="font-600 text-sm mb-4" style={{ color: "#f0f2f5" }}>AI Schedule Classification</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Ahead of Schedule", threshold: "> +5%", active: false, color: "#3b82f6" },
              { label: "On Schedule", threshold: "±5%", active: false, color: "#10b981" },
              { label: "Slightly Behind", threshold: "-5% to -15%", active: true, color: "#f59e0b" },
              { label: "Significantly Behind", threshold: "< -15%", active: false, color: "#ef4444" },
            ].map(({ label, threshold, active, color }) => (
              <div key={label} className="p-3 rounded-xl text-center" style={{ background: active ? `${color}20` : "#252a3a", border: active ? `2px solid ${color}` : "1px solid #2a2f42" }}>
                <div className="text-xs font-600 mb-1" style={{ color: active ? color : "#6b7280" }}>{label}</div>
                <div className="text-xs mono" style={{ color: active ? color : "#374151" }}>{threshold}</div>
                {active && <div className="text-xs mt-1" style={{ color }}>← Current</div>}
              </div>
            ))}
          </div>
        </div>

        {/* AI Recommendation */}
        <div className="rounded-xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <h2 className="font-600 text-sm mb-4" style={{ color: "#f0f2f5" }}>🤖 AI Recommendations to Recover Schedule</h2>
          <div className="space-y-3">
            {[
              "Add 2 additional masons to the wall construction team to accelerate masonry works.",
              "Consider weekend overtime work for the next 3 weeks — estimated cost: ₱45,000.",
              "Pre-order roofing materials now to avoid procurement delays when roofing phase begins.",
              "Review foundation inspection results to ensure Structural Works phase can proceed without rework.",
            ].map((rec, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "#252a3a" }}>
                <span className="text-sm mt-0.5 flex-shrink-0" style={{ color: "#f59e0b" }}>→</span>
                <p className="text-sm" style={{ color: "#9ca3af" }}>{rec}</p>
              </div>
            ))}
          </div>
          <p className="text-xs mt-4" style={{ color: "#374151" }}>These are AI-generated recommendations. The contractor makes all operational decisions.</p>
        </div>
      </div>
    </div>
  );
}
