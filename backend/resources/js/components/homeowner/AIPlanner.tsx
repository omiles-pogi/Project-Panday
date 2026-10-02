import { useState } from "react";

interface AIPlannerProps {
  onNav: (s: string) => void;
}

const plans = [
  {
    title: "Construction Phases & Timeline",
    icon: "📅",
    details: "7 phases: Site Preparation → Foundation → Structural → Walls → Roofing → MEP → Finishing",
    cost: "Included in project",
    duration: "8 months",
    reason: "Based on 120 sqm 2-story residential home. Sequential phasing optimizes labor and material flow.",
    status: "pending" as const,
  },
  {
    title: "Recommended Workforce",
    icon: "👷",
    details: "1 Foreman, 4 Carpenters, 3 Masons, 2 Electricians, 2 Plumbers, 8 Laborers, 1 Painter",
    cost: "₱680,000",
    duration: "8 months",
    reason: "Workforce sized for your building footprint and timeline. Foreman required for coordination.",
    status: "approved" as const,
  },
  {
    title: "Required Equipment",
    icon: "🚧",
    details: "Concrete mixer (3 units), Scaffolding, Welding equipment, Electrical tools, Hand tools",
    cost: "₱85,000",
    duration: "Variable per phase",
    reason: "No heavy machinery needed for residential scale. Concrete mixer rental more cost-effective.",
    status: "pending" as const,
  },
  {
    title: "Material Requirements",
    icon: "🧱",
    details: "2,400 bags cement, 12 tons steel bars, 180 cu.m sand, 200 cu.m gravel, 4,200 hollow blocks",
    cost: "₱1,350,000",
    duration: "Delivered per phase",
    reason: "Quantities based on structural calculation for 120 sqm floor area with standard specifications.",
    status: "pending" as const,
  },
  {
    title: "Estimated Project Budget",
    icon: "₱",
    details: "Materials: ₱1.35M · Labor: ₱680K · Equipment: ₱85K · Permits: ₱45K · Contingency: ₱190K",
    cost: "₱2,350,000",
    duration: "Total",
    reason: "Within your ₱2.5M budget with ₱150K buffer. Contingency set at 8% per construction standards.",
    status: "pending" as const,
  },
  {
    title: "Weekly Progress Schedule",
    icon: "📊",
    details: "Week 1–2: Site prep (5%) · Week 3–6: Foundation (18%) · Week 7–14: Structural (40%) · Week 15–22: MEP + Finishing (37%)",
    cost: "Monitoring tool",
    duration: "32 weeks",
    reason: "Milestone-based schedule allows progress tracking and early detection of delays.",
    status: "rejected" as const,
  },
];

const statusColors = { pending: { bg: "#f59e0b20", text: "#f59e0b", label: "Pending Approval" }, approved: { bg: "#10b98120", text: "#10b981", label: "Approved" }, rejected: { bg: "#ef444420", text: "#ef4444", label: "Rejected" }, modified: { bg: "#3b82f620", text: "#3b82f6", label: "Modified" } };

export default function AIPlanner({ onNav }: AIPlannerProps) {
  const [statuses, setStatuses] = useState<Record<number, "pending" | "approved" | "rejected" | "modified">>(
    Object.fromEntries(plans.map((p, i) => [i, p.status]))
  );
  const [loading, setLoading] = useState(false);

  const setStatus = (i: number, s: "pending" | "approved" | "rejected" | "modified") => setStatuses(prev => ({ ...prev, [i]: s }));

  const handleRegenerate = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <div className="scroll-area">
      <div className="px-4 pt-4 pb-24 max-w-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-600 px-2 py-0.5 rounded-full" style={{ background: "#f59e0b20", color: "#f59e0b" }}>🤖 AI GENERATED</span>
            </div>
            <h1 className="text-2xl font-700" style={{ color: "#f0f2f5" }}>AI Construction Planner</h1>
            <p className="text-sm mt-1" style={{ color: "#6b7280" }}>My House Construction · 120 sqm · 2 Floors · Modern Design</p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleRegenerate} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-500 transition-all" style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42" }}>
              {loading ? "⟳ Regenerating..." : "⟳ Regenerate"}
            </button>
            <button onClick={() => onNav("approvals")} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-600 transition-all hover:opacity-90" style={{ background: "#f59e0b", color: "#0f1117" }}>
              Go to Approvals →
            </button>
          </div>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Estimated Duration", value: "8 months" },
            { label: "AI Budget Estimate", value: "₱2,350,000" },
            { label: "Your Budget", value: "₱2,500,000" },
            { label: "Budget Buffer", value: "₱150,000", color: "#10b981" },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-4 rounded-xl text-center" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
              <div className="text-xs mb-1" style={{ color: "#6b7280" }}>{label}</div>
              <div className="font-700 text-base mono" style={{ color: color || "#f0f2f5" }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Plan cards */}
        <div className="space-y-4">
          {plans.map((plan, i) => {
            const status = statuses[i];
            const sc = statusColors[status];
            return (
              <div key={i} className="rounded-xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{plan.icon}</span>
                    <div>
                      <h3 className="font-600" style={{ color: "#f0f2f5" }}>{plan.title}</h3>
                      <p className="text-sm mt-1" style={{ color: "#9ca3af" }}>{plan.details}</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-600 flex-shrink-0" style={{ background: sc.bg, color: sc.text }}>{sc.label}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: "Estimated Cost", value: plan.cost },
                    { label: "Duration", value: plan.duration },
                    { label: "AI Confidence", value: "92%" },
                  ].map(({ label, value }) => (
                    <div key={label} className="px-3 py-2 rounded-lg" style={{ background: "#252a3a" }}>
                      <div className="text-xs mb-1" style={{ color: "#6b7280" }}>{label}</div>
                      <div className="text-sm font-600 mono" style={{ color: "#f0f2f5" }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 rounded-lg mb-4 text-sm" style={{ background: "#0f111788", borderLeft: "3px solid #f59e0b" }}>
                  <span className="font-500" style={{ color: "#f59e0b" }}>AI Reasoning: </span>
                  <span style={{ color: "#9ca3af" }}>{plan.reason}</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => setStatus(i, "approved")} className="px-4 py-1.5 rounded-lg text-xs font-600 transition-all" style={{ background: status === "approved" ? "#10b981" : "#10b98120", color: status === "approved" ? "#fff" : "#10b981" }}>✓ Approve</button>
                  <button onClick={() => setStatus(i, "modified")} className="px-4 py-1.5 rounded-lg text-xs font-600 transition-all" style={{ background: status === "modified" ? "#3b82f6" : "#3b82f620", color: status === "modified" ? "#fff" : "#3b82f6" }}>✏ Modify</button>
                  <button onClick={() => setStatus(i, "rejected")} className="px-4 py-1.5 rounded-lg text-xs font-600 transition-all" style={{ background: status === "rejected" ? "#ef4444" : "#ef444420", color: status === "rejected" ? "#fff" : "#ef4444" }}>✕ Reject</button>
                  <button onClick={handleRegenerate} className="px-4 py-1.5 rounded-lg text-xs font-600 transition-all" style={{ background: "#252a3a", color: "#9ca3af" }}>⟳ Regenerate</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
