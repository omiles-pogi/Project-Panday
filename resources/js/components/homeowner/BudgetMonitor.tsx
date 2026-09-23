const categories = [
  { name: "Materials", approved: 1350000, spent: 720000 },
  { name: "Labor", approved: 680000, spent: 240000 },
  { name: "Equipment", approved: 85000, spent: 55000 },
  { name: "Transportation", approved: 35000, spent: 25000 },
  { name: "Permits", approved: 45000, spent: 45000 },
  { name: "Other", approved: 25000, spent: 15000 },
  { name: "Contingency", approved: 130000, spent: 0 },
];

function fmt(n: number) {
  if (n >= 1000000) return `₱${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `₱${(n / 1000).toFixed(0)}K`;
  return `₱${n.toLocaleString()}`;
}

export default function BudgetMonitor() {
  const approved = 2500000;
  const spent = categories.reduce((s, c) => s + c.spent, 0);
  const remaining = approved - spent;
  const projected = 2620000;

  return (
    <div className="scroll-area">
      <div className="px-4 pt-4 pb-24 max-w-full">
        <div className="mb-5">
          <h1 className="text-2xl font-700 mb-1" style={{ color: "#f0f2f5" }}>Budget Monitor</h1>
          <p className="text-sm mb-2" style={{ color: "#6b7280" }}>Live tracking · My House Construction</p>
          <span className="px-2.5 py-1 rounded-full text-xs font-600" style={{ background: "#ef444420", color: "#ef4444" }}>⚠ Over Budget Warning</span>
        </div>

        {/* AI Alert */}
        <div className="rounded-xl p-4 mb-5" style={{ background: "#ef444415", border: "1px solid #ef444440" }}>
          <div className="flex items-start gap-3">
            <span className="text-lg flex-shrink-0">🤖</span>
            <div>
              <div className="font-600 text-sm mb-1" style={{ color: "#ef4444" }}>AI Budget Alert</div>
              <p className="text-xs leading-relaxed" style={{ color: "#fca5a5" }}>
                Project may exceed approved budget by ~₱120,000. Materials are tracking 8% above estimates. Recommend reviewing procurement and negotiating supplier rates.
              </p>
              <div className="flex gap-2 mt-3 flex-wrap">
                <button className="px-3 py-1.5 rounded-lg text-xs font-500" style={{ background: "#ef444420", color: "#ef4444" }}>View Expenses</button>
                <button className="px-3 py-1.5 rounded-lg text-xs font-500" style={{ background: "#252a3a", color: "#9ca3af" }}>Recommendation</button>
              </div>
            </div>
          </div>
        </div>

        {/* Top cards */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: "Approved Budget", value: fmt(approved), color: "#9ca3af" },
            { label: "Amount Spent", value: fmt(spent), color: "#f59e0b" },
            { label: "Remaining", value: fmt(remaining), color: "#10b981" },
            { label: "Projected Final", value: fmt(projected), color: "#ef4444" },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-4 rounded-xl" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
              <div className="text-xs mb-1" style={{ color: "#6b7280" }}>{label}</div>
              <div className="text-lg font-700 mono" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Overall bar */}
        <div className="rounded-xl p-4 mb-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <div className="flex justify-between text-xs mb-2">
            <span style={{ color: "#9ca3af" }}>Budget Utilization</span>
            <span className="mono font-600" style={{ color: "#f59e0b" }}>{((spent / approved) * 100).toFixed(1)}% Spent</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden flex" style={{ background: "#252a3a" }}>
            <div className="h-full" style={{ width: `${(spent / approved) * 100}%`, background: "linear-gradient(90deg, #10b981, #f59e0b)" }} />
            <div className="h-full opacity-40" style={{ width: `${Math.min(((projected - spent) / approved) * 100, 100 - (spent / approved) * 100)}%`, background: "#ef4444" }} />
          </div>
          <div className="flex justify-between text-xs mt-2">
            <span style={{ color: "#6b7280" }}>₱0</span>
            <span style={{ color: "#ef4444" }}>Projected: {fmt(projected)} (+{(((projected - approved) / approved) * 100).toFixed(1)}%)</span>
            <span style={{ color: "#6b7280" }}>{fmt(approved)}</span>
          </div>
        </div>

        {/* Category cards */}
        <div className="rounded-xl overflow-hidden" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "#2a2f42" }}>
            <h2 className="font-600 text-sm" style={{ color: "#f0f2f5" }}>Budget by Category</h2>
          </div>
          <div className="divide-y" style={{ borderColor: "#1e2235" }}>
            {categories.map((c) => {
              const rem = c.approved - c.spent;
              const pct = c.approved > 0 ? (c.spent / c.approved) * 100 : 0;
              const status = pct >= 100
                ? { label: "Maxed", color: "#ef4444" }
                : pct >= 85
                  ? { label: "Near Limit", color: "#f59e0b" }
                  : { label: "OK", color: "#10b981" };
              return (
                <div key={c.name} className="px-4 py-3" style={{ borderBottom: "1px solid #1e2235" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-500 text-sm" style={{ color: "#f0f2f5" }}>{c.name}</span>
                    <span className="px-2 py-0.5 rounded text-xs font-600" style={{ background: `${status.color}20`, color: status.color }}>{status.label}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: "#252a3a" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: status.color }} />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: "#6b7280" }}>Spent: <span className="mono font-500" style={{ color: "#f59e0b" }}>{fmt(c.spent)}</span></span>
                    <span style={{ color: "#6b7280" }}>Approved: <span className="mono" style={{ color: "#9ca3af" }}>{fmt(c.approved)}</span></span>
                    <span style={{ color: "#6b7280" }}>Left: <span className="mono" style={{ color: rem >= 0 ? "#10b981" : "#ef4444" }}>{fmt(rem)}</span></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
