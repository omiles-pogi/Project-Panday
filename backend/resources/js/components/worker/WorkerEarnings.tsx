const payHistory = [
  { period: "Sep 1–15, 2026", days: 10, ot: 5, gross: 9125, deductions: 1248, net: 7877, status: "pending" },
  { period: "Aug 16–31, 2026", days: 13, ot: 8, gross: 12050, deductions: 1620, net: 10430, status: "released" },
  { period: "Aug 1–15, 2026", days: 14, ot: 3, gross: 12788, deductions: 1720, net: 11068, status: "released" },
  { period: "Jul 16–31, 2026", days: 13, ot: 0, gross: 11050, deductions: 1480, net: 9570, status: "released" },
];

const deductionBreakdown = [
  { label: "SSS Contribution", amount: 583 },
  { label: "PhilHealth", amount: 250 },
  { label: "Pag-IBIG", amount: 100 },
  { label: "Withholding Tax", amount: 315 },
];

export default function WorkerEarnings() {
  const totalReleased = payHistory.filter(p => p.status === "released").reduce((s, p) => s + p.net, 0);

  return (
    <div className="scroll-area">
      <div className="px-4 pt-4 pb-24 max-w-full">
        <div className="mb-5">
          <h1 className="text-2xl font-700 mb-1" style={{ color: "#f0f2f5" }}>Earnings</h1>
          <p className="text-sm" style={{ color: "#6b7280" }}>Marco Aquino · Mason · Pay history</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: "Daily Rate", value: "₱850", sub: "Regular", color: "#f0f2f5" },
            { label: "OT Rate /hr", value: "₱1,063", sub: "x1.25 multiplier", color: "#f43f5e" },
            { label: "Total Released", value: `₱${totalReleased.toLocaleString()}`, sub: "This project", color: "#10b981" },
            { label: "Pending Pay", value: "₱7,877", sub: "Sep 1–15 cutoff", color: "#f59e0b" },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="p-4 rounded-xl" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
              <div className="text-xs mb-1" style={{ color: "#6b7280" }}>{label}</div>
              <div className="text-lg font-700 mono mb-0.5" style={{ color }}>{value}</div>
              <div className="text-xs" style={{ color: "#6b7280" }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Pay history — card list */}
        <div className="rounded-xl overflow-hidden mb-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "#2a2f42" }}>
            <h2 className="font-600 text-sm" style={{ color: "#f0f2f5" }}>Pay History</h2>
          </div>
          <div className="divide-y" style={{ borderColor: "#1e2235" }}>
            {payHistory.map((p, i) => (
              <div key={i} className="px-4 py-3" style={{ borderBottom: i < payHistory.length - 1 ? "1px solid #1e2235" : "none" }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-500" style={{ color: "#f0f2f5" }}>{p.period}</span>
                  <span className="px-2 py-0.5 rounded text-xs font-500" style={{ background: p.status === "released" ? "#10b98120" : "#f59e0b20", color: p.status === "released" ? "#10b981" : "#f59e0b" }}>
                    {p.status === "released" ? "✓ Released" : "Pending"}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: "#6b7280" }}>
                    {p.days} days{p.ot > 0 ? <span style={{ color: "#f43f5e" }}> · +{p.ot}h OT</span> : ""}
                  </span>
                  <div className="flex gap-3">
                    <span style={{ color: "#6b7280" }}>Gross: <span className="mono" style={{ color: "#9ca3af" }}>₱{p.gross.toLocaleString()}</span></span>
                    <span style={{ color: "#6b7280" }}>Net: <span className="mono font-600" style={{ color: "#10b981" }}>₱{p.net.toLocaleString()}</span></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Current period deductions */}
        <div className="rounded-xl p-4" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <h2 className="font-600 text-sm mb-1" style={{ color: "#f0f2f5" }}>Current Period Deductions</h2>
          <div className="text-xs mb-3" style={{ color: "#6b7280" }}>Sep 1–15, 2026</div>
          <div className="space-y-2 mb-4">
            {deductionBreakdown.map(({ label, amount }) => (
              <div key={label} className="flex justify-between items-center px-3 py-2 rounded-lg" style={{ background: "#252a3a" }}>
                <span className="text-xs" style={{ color: "#9ca3af" }}>{label}</span>
                <span className="mono text-xs font-500" style={{ color: "#ef4444" }}>−₱{amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 space-y-2" style={{ borderColor: "#2a2f42" }}>
            <div className="flex justify-between text-sm">
              <span style={{ color: "#9ca3af" }}>Total Deductions</span>
              <span className="mono font-700" style={{ color: "#ef4444" }}>−₱{deductionBreakdown.reduce((s, d) => s + d.amount, 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: "#9ca3af" }}>Gross Pay</span>
              <span className="mono font-700" style={{ color: "#f0f2f5" }}>₱9,125</span>
            </div>
            <div className="flex justify-between text-base font-700 pt-2 border-t" style={{ borderColor: "#2a2f42" }}>
              <span style={{ color: "#f0f2f5" }}>Net Pay</span>
              <span className="mono" style={{ color: "#10b981" }}>₱7,877</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
