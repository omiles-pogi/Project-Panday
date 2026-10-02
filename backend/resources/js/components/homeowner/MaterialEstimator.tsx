import { useState } from "react";
import { usePlan } from "../../lib/ai/PlanContext";
import BriefPrompt from "./BriefPrompt";

const catColors: Record<string, string> = {
  Concrete: "#f59e0b", Structural: "#3b82f6", Aggregate: "#10b981",
  Carpentry: "#8b5cf6", Masonry: "#f43f5e", Roofing: "#06b6d4",
  Electrical: "#fbbf24", Plumbing: "#34d399", Finishing: "#a78bfa",
};
const fallbackColor = "#6b7280";

export default function MaterialEstimator() {
  const { plan, brief, loading, error, generate } = usePlan();
  const [search, setSearch] = useState("");
  const [approved, setApproved] = useState<Record<number, boolean>>({});

  if (!plan) {
    return (
      <div className="scroll-area">
        <div className="px-4 pt-4 pb-24 max-w-full">
          <div className="mb-5">
            <span className="text-xs font-600 px-2 py-0.5 rounded-full" style={{ background: "#f59e0b20", color: "#f59e0b" }}>🤖 AI GENERATED</span>
            <h1 className="text-2xl font-700 mt-2 mb-1" style={{ color: "#f0f2f5" }}>Material Estimator</h1>
          </div>
          <BriefPrompt onGenerate={generate} loading={loading} error={error} />
        </div>
      </div>
    );
  }

  const materials = plan.materials;
  const filtered = materials
    .map((m, i) => ({ ...m, idx: i }))
    .filter(m =>
      m.material.toLowerCase().includes(search.toLowerCase()) ||
      m.category.toLowerCase().includes(search.toLowerCase())
    );
  const total = materials.reduce((sum, m) => sum + m.qty * m.unitPrice, 0);
  const approvedCount = Object.values(approved).filter(Boolean).length;

  return (
    <div className="scroll-area">
      <div className="px-4 pt-4 pb-24 max-w-full">
        <div className="mb-5">
          <span className="text-xs font-600 px-2 py-0.5 rounded-full" style={{ background: "#f59e0b20", color: "#f59e0b" }}>🤖 AI GENERATED</span>
          <div className="flex items-center justify-between mt-2">
            <div>
              <h1 className="text-2xl font-700 mb-0.5" style={{ color: "#f0f2f5" }}>Material Estimator</h1>
              <p className="text-sm" style={{ color: "#6b7280" }}>{plan.projectTitle}</p>
            </div>
            <button onClick={() => brief && generate(brief)} disabled={loading} className="px-3 py-2 rounded-xl text-sm font-600" style={{ background: "#f59e0b", color: "#0f1117", opacity: loading ? 0.6 : 1 }}>
              {loading ? "⟳…" : "⟳ Regenerate"}
            </button>
          </div>
        </div>

        <div className="rounded-xl px-4 py-3 mb-4 flex gap-2 items-start" style={{ background: "#f59e0b15", border: "1px solid #f59e0b30" }}>
          <span className="flex-shrink-0">⚠️</span>
          <p className="text-xs leading-relaxed" style={{ color: "#fbbf24" }}>
            AI-estimated prices. Final prices depend on supplier negotiations and market conditions.
          </p>
        </div>

        {/* Search + totals */}
        <div className="rounded-xl px-4 py-3 mb-4 flex items-center gap-2" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <span style={{ color: "#6b7280" }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search materials…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "#f0f2f5" }}
          />
          <span className="text-xs font-700 mono flex-shrink-0" style={{ color: "#f59e0b" }}>₱{(total / 1000000).toFixed(2)}M</span>
        </div>

        {/* Material cards */}
        <div className="space-y-2 mb-4">
          {filtered.map((m) => {
            const lineTotal = m.qty * m.unitPrice;
            const catColor = catColors[m.category] || fallbackColor;
            const isApproved = !!approved[m.idx];
            return (
              <div key={m.idx} className="rounded-xl px-4 py-3" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex-1 min-w-0">
                    <span className="font-600 text-sm leading-snug" style={{ color: "#f0f2f5" }}>{m.material}</span>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded text-xs font-500" style={{ background: catColor + "20", color: catColor }}>{m.category}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-700 mono text-sm" style={{ color: "#f59e0b" }}>₱{lineTotal.toLocaleString()}</div>
                    <div className="text-xs" style={{ color: "#6b7280" }}>{m.qty.toLocaleString()} {m.unit} × ₱{m.unitPrice.toLocaleString()}</div>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setApproved(p => ({ ...p, [m.idx]: !p[m.idx] }))}
                    className="px-3 py-1 rounded-lg text-xs font-500 transition-all"
                    style={{ background: isApproved ? "#10b98120" : "#252a3a", color: isApproved ? "#10b981" : "#9ca3af", border: `1px solid ${isApproved ? "#10b98140" : "#2a2f42"}` }}
                  >
                    {isApproved ? "✓ Approved" : "Approve"}
                  </button>
                  <button className="px-3 py-1 rounded-lg text-xs" style={{ background: "#252a3a", color: "#9ca3af" }}>Edit</button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-center px-1 py-2 mb-5">
          <span className="text-xs" style={{ color: "#6b7280" }}>{filtered.length} items · {approvedCount} approved</span>
          <span className="font-700 mono text-sm" style={{ color: "#f59e0b" }}>Total: ₱{total.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
