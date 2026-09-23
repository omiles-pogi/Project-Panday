import { usePlan } from "../../lib/ai/PlanContext";
import BriefPrompt from "./BriefPrompt";

const PALETTE = ["#f59e0b", "#3b82f6", "#8b5cf6", "#10b981", "#f43f5e", "#06b6d4", "#fbbf24", "#a78bfa", "#34d399", "#6b7280"];
const colorFor = (i: number) => PALETTE[i % PALETTE.length];

export default function BudgetGenerator() {
  const { plan, brief, loading, error, generate } = usePlan();

  if (!plan) {
    return (
      <div className="scroll-area">
        <div className="px-4 pt-4 pb-24 max-w-full">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-600 px-2 py-0.5 rounded-full" style={{ background: "#f59e0b20", color: "#f59e0b" }}>🤖 AI GENERATED</span>
            </div>
            <h1 className="text-2xl font-700" style={{ color: "#f0f2f5" }}>AI Budget Generator</h1>
          </div>
          <BriefPrompt onGenerate={generate} loading={loading} error={error} />
        </div>
      </div>
    );
  }

  const budgetItems = plan.budgetBreakdown.map((b, i) => ({ ...b, color: colorFor(i) }));
  const total = budgetItems.reduce((s, b) => s + b.amount, 0) || plan.totalEstimate;
  const buffer = plan.budget - plan.totalEstimate;
  const status = buffer > plan.budget * 0.05 ? "within" : buffer >= 0 ? "near" : "over";

  const statusMap = {
    within: { label: "WITHIN BUDGET", color: "#10b981", bg: "#10b98120" },
    near: { label: "NEAR BUDGET LIMIT", color: "#f59e0b", bg: "#f59e0b20" },
    over: { label: "OVER BUDGET", color: "#ef4444", bg: "#ef444420" },
  };
  const s = statusMap[status];

  return (
    <div className="scroll-area">
      <div className="px-4 pt-4 pb-24 max-w-full">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-600 px-2 py-0.5 rounded-full" style={{ background: "#f59e0b20", color: "#f59e0b" }}>🤖 AI GENERATED</span>
            </div>
            <h1 className="text-2xl font-700" style={{ color: "#f0f2f5" }}>AI Budget Generator</h1>
            <p className="text-sm mt-1" style={{ color: "#6b7280" }}>{plan.projectTitle} · {plan.location}</p>
          </div>
          <button
            onClick={() => brief && generate(brief)}
            disabled={loading}
            className="px-3 py-2 rounded-lg text-sm font-500 flex-shrink-0"
            style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "⟳ Regenerating…" : "⟳ Regenerate"}
          </button>
        </div>

        {/* Budget summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="p-5 rounded-xl text-center" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
            <div className="text-xs mb-2" style={{ color: "#6b7280" }}>Allowable Budget</div>
            <div className="text-3xl font-800 mono mb-1" style={{ color: "#f0f2f5" }}>₱{plan.budget.toLocaleString()}</div>
            <div className="text-xs" style={{ color: "#6b7280" }}>Set by homeowner</div>
          </div>
          <div className="p-5 rounded-xl text-center" style={{ background: "#1a1d27", border: "1px solid #f59e0b30" }}>
            <div className="text-xs mb-2" style={{ color: "#6b7280" }}>AI Estimated Budget</div>
            <div className="text-3xl font-800 mono mb-1" style={{ color: "#f59e0b" }}>₱{plan.totalEstimate.toLocaleString()}</div>
            <div className="text-xs" style={{ color: "#6b7280" }}>AI recommendation</div>
          </div>
          <div className="p-5 rounded-xl text-center" style={{ background: "#1a1d27", border: `1px solid ${s.color}30` }}>
            <div className="text-xs mb-2" style={{ color: "#6b7280" }}>Budget Buffer</div>
            <div className="text-3xl font-800 mono mb-1" style={{ color: s.color }}>₱{buffer.toLocaleString()}</div>
            <div className="px-2 py-0.5 rounded-full text-xs font-600 inline-block" style={{ background: s.bg, color: s.color }}>{s.label}</div>
          </div>
        </div>

        {/* Comparison bar */}
        <div className="rounded-xl p-5 mb-6" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <h2 className="font-600 text-sm mb-4" style={{ color: "#f0f2f5" }}>Budget Comparison</h2>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1.5" style={{ color: "#9ca3af" }}>
                <span>Allowable Budget</span><span className="mono">₱{plan.budget.toLocaleString()}</span>
              </div>
              <div className="h-3 rounded-full" style={{ background: "#f0f2f510" }}>
                <div className="h-full rounded-full" style={{ width: "100%", background: "#374151" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1.5" style={{ color: "#9ca3af" }}>
                <span>AI Estimated Cost</span><span className="mono" style={{ color: "#f59e0b" }}>₱{plan.totalEstimate.toLocaleString()}</span>
              </div>
              <div className="h-3 rounded-full" style={{ background: "#f0f2f510" }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min((plan.totalEstimate / plan.budget) * 100, 100)}%`, background: "linear-gradient(90deg, #f59e0b, #fbbf24)" }} />
              </div>
            </div>
          </div>
          <div className="mt-3 text-xs" style={{ color: "#6b7280" }}>AI estimate is {((plan.totalEstimate / plan.budget) * 100).toFixed(1)}% of your allowable budget — {s.label.toLowerCase()}.</div>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-1 gap-4 mb-5">
          <div className="rounded-xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
            <h2 className="font-600 text-sm mb-4" style={{ color: "#f0f2f5" }}>Budget Distribution</h2>
            <div className="space-y-3">
              {budgetItems.map(({ category, amount, color }) => {
                const pct = total ? (amount / total) * 100 : 0;
                return (
                  <div key={category}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                        <span style={{ color: "#9ca3af" }}>{category}</span>
                      </div>
                      <div className="flex gap-3">
                        <span className="mono" style={{ color: "#6b7280" }}>{pct.toFixed(1)}%</span>
                        <span className="mono font-500" style={{ color: "#f0f2f5" }}>₱{amount.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: "#252a3a" }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
            <h2 className="font-600 text-sm mb-4" style={{ color: "#f0f2f5" }}>Cost Breakdown</h2>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: "#6b7280" }}>
                  <th className="text-left text-xs pb-3 font-500">Category</th>
                  <th className="text-right text-xs pb-3 font-500">Amount</th>
                  <th className="text-right text-xs pb-3 font-500">%</th>
                </tr>
              </thead>
              <tbody>
                {budgetItems.map(({ category, amount, color }) => {
                  const pct = total ? (amount / total) * 100 : 0;
                  return (
                    <tr key={category} className="border-t" style={{ borderColor: "#2a2f42" }}>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                          <span style={{ color: "#9ca3af" }}>{category}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right mono font-500" style={{ color: "#f0f2f5" }}>₱{amount.toLocaleString()}</td>
                      <td className="py-2.5 text-right mono text-xs" style={{ color: "#6b7280" }}>{pct.toFixed(1)}%</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2" style={{ borderColor: "#f59e0b40" }}>
                  <td className="py-3 font-700" style={{ color: "#f0f2f5" }}>TOTAL</td>
                  <td className="py-3 text-right mono font-700" style={{ color: "#f59e0b" }}>₱{plan.totalEstimate.toLocaleString()}</td>
                  <td className="py-3 text-right mono text-xs font-700" style={{ color: "#f59e0b" }}>100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button className="w-full py-3.5 rounded-xl font-700 text-sm" style={{ background: "#f59e0b", color: "#0f1117" }}>Approve Budget Plan</button>
          <div className="flex gap-2">
            <button className="flex-1 py-3 rounded-xl font-500 text-sm" style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42" }}>Modify Assumptions</button>
            <button onClick={() => brief && generate(brief)} disabled={loading} className="flex-1 py-3 rounded-xl font-500 text-sm" style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42", opacity: loading ? 0.6 : 1 }}>⟳ Regenerate</button>
          </div>
        </div>
      </div>
    </div>
  );
}
