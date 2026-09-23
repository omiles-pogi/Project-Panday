import { useState, useRef, useEffect } from "react";
import { usePlan } from "../../lib/ai/PlanContext";
import type { ConstructionPlan } from "../../lib/ai/types";

/* ─── Types ─── */
type MsgRole = "user" | "ai";
type CardType = "plan" | "budget" | "materials" | "equipment" | "design" | "summary";

interface ChatMessage {
  id: number;
  role: MsgRole;
  text: string;
  card?: CardType;
  quickReplies?: string[];
  typing?: boolean;
}

let uid = 100;
const nextId = () => ++uid;

const PALETTE = ["#f59e0b", "#3b82f6", "#8b5cf6", "#10b981", "#f43f5e", "#06b6d4", "#fbbf24", "#a78bfa", "#34d399", "#6b7280"];
const colorFor = (i: number) => PALETTE[i % PALETTE.length];
const peso = (n: number) => `₱${Math.round(n).toLocaleString()}`;

/* ─── Sub-components ─── */
function Chip({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-500 transition-all hover:scale-[1.02]"
      style={{ background: "#f59e0b15", color: "#f59e0b", border: "1px solid #f59e0b30" }}
    >
      {text}
    </button>
  );
}

function SectionHeader({ icon, title, badge }: { icon: string; title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base">{icon}</span>
      <span className="font-700 text-sm" style={{ color: "#f0f2f5" }}>{title}</span>
      {badge && <span className="text-xs px-2 py-0.5 rounded-full font-600" style={{ background: "#f59e0b20", color: "#f59e0b" }}>{badge}</span>}
    </div>
  );
}

/* ── PLAN OVERVIEW CARD ── */
function PlanCard({ plan, onNext }: { plan: ConstructionPlan; onNext: () => void }) {
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const buffer = plan.budget - plan.totalEstimate;
  const items = [
    { icon: "📅", title: "Timeline", value: `${plan.timelineMonths} months`, detail: `${plan.phases.length} phases`, color: "#3b82f6" },
    { icon: "₱", title: "AI Budget Estimate", value: peso(plan.totalEstimate), detail: buffer >= 0 ? `Within budget · ${peso(buffer)} buffer` : `Over budget by ${peso(Math.abs(buffer))}`, color: "#f59e0b" },
    { icon: "🧱", title: "Key Materials", value: `${plan.materials.length} material types`, detail: plan.materials.slice(0, 3).map(m => m.material).join(", "), color: "#10b981" },
    { icon: "🏠", title: "Design", value: plan.designStyle, detail: `${plan.bedrooms}BR / ${plan.bathrooms}BA · ${plan.areaSqm} sqm`, color: "#8b5cf6" },
    { icon: "🚧", title: "Equipment", value: `${plan.equipment.length} equipment types`, detail: plan.equipment.slice(0, 3).map(e => e.name).join(", "), color: "#f43f5e" },
    { icon: "📐", title: "Phases", value: `${plan.phases.length} phases`, detail: plan.phases.map(p => p.name).join(" → "), color: "#06b6d4" },
  ];
  const allApproved = items.every(i => approved[i.title]);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#1e2235", border: "1px solid #2a2f42" }}>
      <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "#2a2f42", background: "#252a3a" }}>
        <SectionHeader icon="🤖" title="Construction Plan Overview" badge="AI Generated" />
      </div>
      <div className="p-4 grid grid-cols-2 gap-2">
        {items.map(item => (
          <div key={item.title} className="rounded-xl p-3 flex items-start gap-2.5 transition-all" style={{ background: approved[item.title] ? `${item.color}12` : "#252a3a", border: approved[item.title] ? `1px solid ${item.color}50` : "1px solid transparent" }}>
            <span className="text-lg flex-shrink-0">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-600 uppercase tracking-wider mb-0.5" style={{ color: item.color }}>{item.title}</div>
              <div className="font-700 text-sm" style={{ color: "#f0f2f5" }}>{item.value}</div>
              <div className="text-xs mt-0.5 truncate" style={{ color: "#6b7280" }}>{item.detail}</div>
            </div>
            {approved[item.title] && <span className="text-xs" style={{ color: item.color }}>✓</span>}
          </div>
        ))}
      </div>
      <div className="px-4 pb-4 flex gap-2">
        {allApproved
          ? <button onClick={onNext} className="w-full py-2.5 rounded-xl text-sm font-700 hover:opacity-90 transition-all" style={{ background: "#f59e0b", color: "#0f1117" }}>Continue to Budget Breakdown →</button>
          : <>
              <button onClick={() => setApproved(Object.fromEntries(items.map(i => [i.title, true])))} className="flex-1 py-2 rounded-xl text-sm font-600 hover:opacity-90" style={{ background: "#f59e0b", color: "#0f1117" }}>✓ Approve All</button>
              {items.filter(i => !approved[i.title]).slice(0, 1).map(i => (
                <button key={i.title} onClick={() => setApproved(p => ({ ...p, [i.title]: true }))} className="flex-1 py-2 rounded-xl text-sm font-500" style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42" }}>Approve One by One</button>
              ))}
            </>
        }
      </div>
    </div>
  );
}

/* ── BUDGET CARD ── */
function BudgetCard({ plan, onNext }: { plan: ConstructionPlan; onNext: () => void }) {
  const total = plan.budgetBreakdown.reduce((s, b) => s + b.amount, 0) || plan.totalEstimate;
  const buffer = plan.budget - plan.totalEstimate;
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#1e2235", border: "1px solid #2a2f42" }}>
      <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "#2a2f42", background: "#252a3a" }}>
        <SectionHeader icon="₱" title="Budget Breakdown" badge="AI Estimate" />
      </div>
      <div className="p-4">
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: "Your Budget", value: `₱${(plan.budget / 1000000).toFixed(2)}M`, color: "#9ca3af" },
            { label: "AI Estimate", value: `₱${(plan.totalEstimate / 1000000).toFixed(2)}M`, color: "#f59e0b" },
            { label: "Buffer", value: `${buffer >= 0 ? "₱" : "-₱"}${Math.abs(buffer / 1000).toFixed(0)}K`, color: buffer >= 0 ? "#10b981" : "#ef4444" },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-3 rounded-xl text-center" style={{ background: "#252a3a" }}>
              <div className="text-xs mb-1" style={{ color: "#6b7280" }}>{label}</div>
              <div className="font-700 mono text-base" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>
        <div className="space-y-2 mb-4">
          {plan.budgetBreakdown.map(({ category, amount }, i) => {
            const pct = total ? (amount / total) * 100 : 0;
            const color = colorFor(i);
            return (
              <div key={category}>
                <div className="flex justify-between text-xs mb-1">
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: color }} /><span style={{ color: "#9ca3af" }}>{category}</span></div>
                  <div className="flex gap-3"><span className="mono" style={{ color: "#6b7280" }}>{pct.toFixed(1)}%</span><span className="mono font-500" style={{ color: "#f0f2f5" }}>{peso(amount)}</span></div>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: "#2a2f42" }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          <button onClick={onNext} className="flex-1 py-2.5 rounded-xl text-sm font-700 hover:opacity-90" style={{ background: "#f59e0b", color: "#0f1117" }}>✓ Approve Budget · Next →</button>
          <button className="px-4 py-2.5 rounded-xl text-sm font-500" style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42" }}>Modify</button>
        </div>
      </div>
    </div>
  );
}

/* ── MATERIALS CARD ── */
function MaterialsCard({ plan, onNext }: { plan: ConstructionPlan; onNext: () => void }) {
  const [approved, setApproved] = useState<Record<number, boolean>>({});
  const total = plan.materials.reduce((s, m) => s + m.qty * m.unitPrice, 0);
  const allApproved = plan.materials.every((_, i) => approved[i]);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#1e2235", border: "1px solid #2a2f42" }}>
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "#2a2f42", background: "#252a3a" }}>
        <SectionHeader icon="🧱" title="Material Estimates" badge="AI Generated" />
        <span className="mono text-sm font-700" style={{ color: "#f59e0b" }}>{peso(total)}</span>
      </div>
      <div className="px-4 py-2" style={{ maxHeight: 280, overflowY: "auto" }}>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #2a2f42" }}>
          <table className="w-full text-xs">
            <thead><tr style={{ borderBottom: "1px solid #2a2f42", background: "#252a3a" }}>
              {["Material", "Qty", "Unit", "Price", "Total", ""].map(h => <th key={h} className="text-left px-3 py-2 font-600" style={{ color: "#6b7280" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {plan.materials.map((m, i) => (
                <tr key={i} className="border-b" style={{ borderColor: "#1e2235", background: approved[i] ? "#10b98108" : "transparent" }}>
                  <td className="px-3 py-2 font-500" style={{ color: "#f0f2f5" }}>{m.material}</td>
                  <td className="px-3 py-2 mono" style={{ color: "#9ca3af" }}>{m.qty.toLocaleString()}</td>
                  <td className="px-3 py-2" style={{ color: "#6b7280" }}>{m.unit}</td>
                  <td className="px-3 py-2 mono" style={{ color: "#9ca3af" }}>{peso(m.unitPrice)}</td>
                  <td className="px-3 py-2 mono font-600" style={{ color: "#f59e0b" }}>{peso(m.qty * m.unitPrice)}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => setApproved(p => ({ ...p, [i]: !p[i] }))} className="px-2 py-0.5 rounded text-xs font-500" style={{ background: approved[i] ? "#10b98120" : "#252a3a", color: approved[i] ? "#10b981" : "#9ca3af" }}>
                      {approved[i] ? "✓" : "OK"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="p-4 border-t" style={{ borderColor: "#2a2f42" }}>
        <p className="text-xs mb-3" style={{ color: "#6b7280" }}>⚠ Prices are AI estimates. Actual costs may vary based on supplier and market conditions.</p>
        <div className="flex gap-2">
          <button onClick={() => { setApproved(Object.fromEntries(plan.materials.map((_, i) => [i, true]))); }} className="flex-1 py-2.5 rounded-xl text-sm font-600 hover:opacity-90" style={{ background: allApproved ? "#252a3a" : "#f59e0b15", color: allApproved ? "#9ca3af" : "#f59e0b", border: "1px solid #f59e0b30" }}>
            {allApproved ? "All Approved ✓" : "✓ Approve All Materials"}
          </button>
          {allApproved && <button onClick={onNext} className="flex-1 py-2.5 rounded-xl text-sm font-700 hover:opacity-90" style={{ background: "#f59e0b", color: "#0f1117" }}>Next: Equipment →</button>}
        </div>
      </div>
    </div>
  );
}

/* ── EQUIPMENT CARD ── */
function EquipmentCard({ plan, onNext }: { plan: ConstructionPlan; onNext: () => void }) {
  const [approved, setApproved] = useState(false);
  const total = plan.equipment.reduce((s, e) => s + e.cost, 0);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#1e2235", border: "1px solid #2a2f42" }}>
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "#2a2f42", background: "#252a3a" }}>
        <SectionHeader icon="🚧" title="Equipment Requirements" badge="AI Generated" />
        <span className="mono text-sm font-700" style={{ color: "#f59e0b" }}>{peso(total)}</span>
      </div>
      <div className="px-4 py-3" style={{ maxHeight: 260, overflowY: "auto" }}>
        <div className="space-y-1.5">
          {plan.equipment.map((e, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: "#252a3a" }}>
              <span className="text-base">🔧</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-500" style={{ color: "#f0f2f5" }}>{e.name}</div>
                <div className="text-xs" style={{ color: "#6b7280" }}>{e.phase} · {e.duration}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="mono text-xs font-600" style={{ color: "#f59e0b" }}>{peso(e.cost)}</div>
                <div className="text-xs" style={{ color: "#6b7280" }}>×{e.qty}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="p-4 border-t" style={{ borderColor: "#2a2f42" }}>
        <div className="flex gap-2">
          <button onClick={() => setApproved(true)} className="flex-1 py-2.5 rounded-xl text-sm font-600 hover:opacity-90" style={{ background: approved ? "#10b98120" : "#f59e0b15", color: approved ? "#10b981" : "#f59e0b", border: `1px solid ${approved ? "#10b98130" : "#f59e0b30"}` }}>
            {approved ? "Equipment Approved ✓" : "✓ Approve Equipment"}
          </button>
          {approved && <button onClick={onNext} className="flex-1 py-2.5 rounded-xl text-sm font-700 hover:opacity-90" style={{ background: "#f59e0b", color: "#0f1117" }}>Next: Design →</button>}
        </div>
      </div>
    </div>
  );
}

/* ── DESIGN CARD ── */
function DesignCard({ plan, onNext }: { plan: ConstructionPlan; onNext: () => void }) {
  const [approved, setApproved] = useState(false);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#1e2235", border: "1px solid #2a2f42" }}>
      <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "#2a2f42", background: "#252a3a" }}>
        <SectionHeader icon="📐" title="AI Conceptual Design" badge="AI Generated" />
        {approved && <span className="ml-auto text-xs font-600 px-2 py-0.5 rounded-full" style={{ background: "#10b98120", color: "#10b981" }}>Approved</span>}
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { label: "Exterior", value: plan.exteriorConcept },
            { label: "Interior", value: plan.interiorConcept },
            { label: "Floor Area", value: `${plan.areaSqm} sqm · ${plan.floors} floor${plan.floors > 1 ? "s" : ""} · ${plan.bedrooms}BR / ${plan.bathrooms} bath` },
            { label: "Design Style", value: plan.designStyle },
          ].map(({ label, value }) => (
            <div key={label} className="px-3 py-2 rounded-lg" style={{ background: "#252a3a" }}>
              <div className="text-xs mb-0.5" style={{ color: "#6b7280" }}>{label}</div>
              <div className="text-xs font-500" style={{ color: "#f0f2f5" }}>{value}</div>
            </div>
          ))}
        </div>
        <p className="text-xs mb-4" style={{ color: "#6b7280" }}>Detailed floor-plan rendering isn't wired to an image model yet — layout below is a generic schematic for reference only.</p>
        <div className="rounded-xl overflow-hidden mb-4" style={{ background: "#0f1117", border: "1px solid #2a2f42" }}>
          <svg viewBox="0 0 720 380" className="w-full" style={{ maxHeight: 220 }}>
            {Array.from({ length: 19 }).map((_, i) => <line key={`v${i}`} x1={i * 40} y1={0} x2={i * 40} y2={380} stroke="#1e2235" strokeWidth="0.5" />)}
            {Array.from({ length: 10 }).map((_, i) => <line key={`h${i}`} x1={0} y1={i * 40} x2={720} y2={i * 40} stroke="#1e2235" strokeWidth="0.5" />)}
            <rect x="60" y="30" width="600" height="320" fill="none" stroke="#f59e0b" strokeWidth="2" rx="3" />
            <text x="360" y="368" textAnchor="middle" fill="#374151" fontSize="9">GENERIC FLOOR PLAN SCHEMATIC · FOR CONCEPTUAL REFERENCE ONLY</text>
          </svg>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setApproved(true)} className="flex-1 py-2.5 rounded-xl text-sm font-600 hover:opacity-90" style={{ background: approved ? "#10b98120" : "#f59e0b15", color: approved ? "#10b981" : "#f59e0b", border: `1px solid ${approved ? "#10b98130" : "#f59e0b30"}` }}>
            {approved ? "✓ Design Approved" : "Approve Design"}
          </button>
          {approved && <button onClick={onNext} className="flex-1 py-2.5 rounded-xl text-sm font-700 hover:opacity-90" style={{ background: "#f59e0b", color: "#0f1117" }}>Finalize →</button>}
        </div>
      </div>
    </div>
  );
}

/* ── SUMMARY CARD ── */
function SummaryCard({ plan }: { plan: ConstructionPlan }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#1e2235", border: "1px solid #10b98140" }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: "#10b98130", background: "#10b98112" }}>
        <div className="flex items-center gap-2">
          <span className="text-xl">🎉</span>
          <span className="font-700 text-sm" style={{ color: "#10b981" }}>Project Plan Complete</span>
          <span className="ml-auto text-xs font-600 px-2 py-0.5 rounded-full" style={{ background: "#10b98120", color: "#10b981" }}>Ready to Share</span>
        </div>
      </div>
      <div className="p-4">
        <div className="space-y-2 mb-4">
          {["Construction Plan", "Budget Breakdown", "Material Estimates", "Equipment Plan", "Conceptual Design"].map(label => (
            <div key={label} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "#252a3a" }}>
              <span className="text-sm" style={{ color: "#9ca3af" }}>{label}</span>
              <span className="text-xs font-600" style={{ color: "#10b981" }}>✓ Approved</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="p-3 rounded-xl text-center" style={{ background: "#252a3a" }}>
            <div className="text-xs mb-1" style={{ color: "#6b7280" }}>Total AI Estimate</div>
            <div className="font-700 mono text-base" style={{ color: "#f59e0b" }}>{peso(plan.totalEstimate)}</div>
          </div>
          <div className="p-3 rounded-xl text-center" style={{ background: "#252a3a" }}>
            <div className="text-xs mb-1" style={{ color: "#6b7280" }}>Project Duration</div>
            <div className="font-700 text-base" style={{ color: "#3b82f6" }}>{plan.timelineMonths} months</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="flex-1 py-2.5 rounded-xl text-sm font-700 hover:opacity-90" style={{ background: "#f59e0b", color: "#0f1117" }}>Find Contractors →</button>
          <button className="px-4 py-2.5 rounded-xl text-sm font-500" style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42" }}>⬇ Download PDF</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Typing dots ─── */
function Dots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map(i => (
        <div key={i} className="w-2 h-2 rounded-full" style={{ background: "#f59e0b", opacity: 0.7, animation: "bounce 1.2s infinite", animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  );
}

const SUGGESTIONS = [
  "3-bedroom house, 120 sqm, modern design, Quezon City, ₱2.5M budget",
  "Two-story commercial building, 200 sqm, Makati, ₱5M budget",
  "Apartment renovation, 80 sqm, Pasig City, ₱800K budget",
  "Restaurant build-out, 60 sqm, BGC, ₱1.2M budget",
];

/* ─── Stage machine ─── */
type Stage = "idle" | "generating" | "plan" | "budget" | "materials" | "equipment" | "design" | "summary";

const STAGE_TEXT: Record<Exclude<Stage, "idle" | "generating">, (p: ConstructionPlan) => string> = {
  plan: (p) => `Here's a complete overview of your construction plan for ${p.projectTitle}. Approve all sections or review them individually.`,
  budget: (p) => `Your AI budget breakdown is ready. Your ₱${(p.budget / 1000000).toFixed(2)}M budget ${p.budget >= p.totalEstimate ? `comfortably covers the estimated ₱${(p.totalEstimate / 1000000).toFixed(2)}M cost` : `is below the estimated ₱${(p.totalEstimate / 1000000).toFixed(2)}M cost — you may want to adjust scope`}.`,
  materials: () => "Here are the AI-estimated material requirements. Prices are based on current market data — review and approve each item.",
  equipment: () => "Here's the recommended equipment list with estimated rental/usage costs per construction phase.",
  design: (p) => `Here's your AI-generated conceptual design concept for a ${p.designStyle.toLowerCase()} ${p.bedrooms}-bedroom, ${p.bathrooms}-bathroom home.`,
  summary: (p) => `All sections are approved! 🎉 Your complete construction plan for ${p.projectTitle} is ready. You can now search for contractors who will receive your approved plan.`,
};

const STAGE_ORDER: Exclude<Stage, "idle" | "generating">[] = ["plan", "budget", "materials", "equipment", "design", "summary"];
const NEXT_LABEL: Record<Exclude<Stage, "idle" | "generating">, string> = {
  plan: "Show me the detailed budget breakdown",
  budget: "Looks good, show me the material list",
  materials: "Great, show me the equipment needed",
  equipment: "Now show me the AI conceptual design",
  design: "Everything looks great. Finalize my project plan.",
  summary: "",
};

function greeting(): ChatMessage {
  return {
    id: nextId(),
    role: "ai",
    text: "Hello! I'm your AI Construction Planner. Describe your project and I'll generate a complete plan — timeline, budget, materials, equipment, and conceptual design — all in one conversation.\n\nYou can type naturally, like: \"3-bedroom house in Quezon City, 120 sqm, ₱2.5M budget, modern design.\"",
    quickReplies: ["Residential house", "Renovation project", "Commercial building", "Two-story apartment"],
  };
}

/* ─── Message renderer ─── */
function AIBubble({ msg, plan, onQuickReply, onAdvance }: { msg: ChatMessage; plan: ConstructionPlan | null; onQuickReply: (text: string) => void; onAdvance: () => void }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 mt-0.5" style={{ background: "#f59e0b20" }}>🤖</div>
      <div className="flex-1 min-w-0 space-y-2">
        {msg.typing
          ? <div className="rounded-2xl rounded-tl-sm inline-block" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}><Dots /></div>
          : <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed inline-block max-w-full" style={{ background: "#1a1d27", border: "1px solid #2a2f42", color: "#e8eaed", whiteSpace: "pre-line" }}>{msg.text}</div>
        }
        {!msg.typing && plan && msg.card === "plan" && <PlanCard plan={plan} onNext={onAdvance} />}
        {!msg.typing && plan && msg.card === "budget" && <BudgetCard plan={plan} onNext={onAdvance} />}
        {!msg.typing && plan && msg.card === "materials" && <MaterialsCard plan={plan} onNext={onAdvance} />}
        {!msg.typing && plan && msg.card === "equipment" && <EquipmentCard plan={plan} onNext={onAdvance} />}
        {!msg.typing && plan && msg.card === "design" && <DesignCard plan={plan} onNext={onAdvance} />}
        {!msg.typing && plan && msg.card === "summary" && <SummaryCard plan={plan} />}
        {!msg.typing && msg.quickReplies && (
          <div className="flex flex-wrap gap-2">
            {msg.quickReplies.map(r => <Chip key={r} text={r} onClick={() => onQuickReply(r)} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function UserBubble({ msg }: { msg: ChatMessage }) {
  return (
    <div className="flex gap-3 items-start justify-end">
      <div className="max-w-lg rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed" style={{ background: "#f59e0b", color: "#0f1117" }}>{msg.text}</div>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-700 flex-shrink-0 mt-0.5" style={{ background: "#3b82f620", color: "#3b82f6" }}>JD</div>
    </div>
  );
}

export default function ProjectChat() {
  const { plan, generate } = usePlan();
  const [messages, setMessages] = useState<ChatMessage[]>([greeting()]);
  const [input, setInput] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const resolveTyping = (id: number, update: Partial<ChatMessage>) => {
    setMessages(p => p.map(m => m.id === id ? { ...m, ...update, typing: false } : m));
  };

  const startGeneration = async (brief: string) => {
    if (!brief.trim() || busy) return;
    setMessages(p => [...p, { id: nextId(), role: "user", text: brief.trim() }]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    setStage("generating");
    setBusy(true);
    const typingId = nextId();
    setMessages(p => [...p, { id: typingId, role: "ai", text: "", typing: true }]);

    try {
      const result = await generate(brief.trim());
      resolveTyping(typingId, { text: `I've processed your requirements. Here's your full AI construction plan for ${result.projectTitle}. Review and approve each section — only approved items will be shared with contractors.` });
      const cardId = nextId();
      setMessages(p => [...p, { id: cardId, role: "ai", text: STAGE_TEXT.plan(result), card: "plan" }]);
      setStage("plan");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong generating your plan.";
      resolveTyping(typingId, { text: `Sorry, I couldn't generate a plan: ${message}` });
      setStage("idle");
    } finally {
      setBusy(false);
    }
  };

  const advance = () => {
    if (!plan || busy) return;
    const currentIndex = STAGE_ORDER.indexOf(stage as Exclude<Stage, "idle" | "generating">);
    const next = STAGE_ORDER[currentIndex + 1];
    if (!next) return;
    const label = NEXT_LABEL[stage as Exclude<Stage, "idle" | "generating">];

    setMessages(p => [...p, { id: nextId(), role: "user", text: label }]);
    setBusy(true);
    const typingId = nextId();
    setMessages(p => [...p, { id: typingId, role: "ai", text: "", typing: true }]);
    setTimeout(() => {
      resolveTyping(typingId, { text: STAGE_TEXT[next](plan), card: next });
      setStage(next);
      setBusy(false);
    }, 650);
  };

  const handleQuickReply = (text: string) => {
    if (stage === "idle") startGeneration(text);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); startGeneration(input); }
  };

  const showSuggestions = messages.length <= 1;

  return (
    <div className="flex flex-col h-full" style={{ background: "#0f1117" }}>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b flex-shrink-0" style={{ background: "#1a1d27", borderColor: "#2a2f42" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#f59e0b20" }}>🤖</div>
        <div>
          <div className="font-600 text-sm" style={{ color: "#f0f2f5" }}>AI Construction Planner</div>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "#10b981" }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#10b981" }} />
            Online · Covers plan, budget, materials, equipment & design
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => { setMessages([greeting()]); setStage("idle"); }} className="px-3 py-1.5 rounded-lg text-xs font-500" style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42" }}>⟳ New Chat</button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {messages.map(msg =>
          msg.role === "ai"
            ? <AIBubble key={msg.id} msg={msg} plan={plan} onQuickReply={handleQuickReply} onAdvance={advance} />
            : <UserBubble key={msg.id} msg={msg} />
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {showSuggestions && (
        <div className="px-4 pb-3 flex-shrink-0">
          <p className="text-xs mb-2" style={{ color: "#6b7280" }}>Quick start:</p>
          <div className="grid grid-cols-2 gap-2">
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => startGeneration(s)} disabled={busy} className="text-left px-3 py-2.5 rounded-xl text-xs transition-all hover:scale-[1.01]" style={{ background: "#1a1d27", border: "1px solid #2a2f42", color: "#9ca3af" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#f59e0b40"; (e.currentTarget as HTMLElement).style.color = "#f0f2f5"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#2a2f42"; (e.currentTarget as HTMLElement).style.color = "#9ca3af"; }}
              >{s}</button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 flex-shrink-0">
        <div className="flex gap-3 items-end rounded-2xl p-3" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
            onKeyDown={handleKey}
            placeholder={busy ? "AI is generating your plan..." : "Describe your project or ask a question..."}
            disabled={busy}
            className="flex-1 bg-transparent text-sm outline-none resize-none leading-relaxed"
            style={{ color: "#f0f2f5", minHeight: 24, maxHeight: 120, caretColor: "#f59e0b" }}
          />
          <button onClick={() => startGeneration(input)} disabled={!input.trim() || busy} className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all" style={{ background: input.trim() && !busy ? "#f59e0b" : "#252a3a" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke={input.trim() && !busy ? "#0f1117" : "#6b7280"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
        <p className="text-xs text-center mt-2" style={{ color: "#2a2f42" }}>AI recommends · You decide · All items require your approval</p>
      </div>

      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-5px);opacity:1} }`}</style>
    </div>
  );
}
