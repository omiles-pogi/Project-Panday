import { useState, useRef, useEffect } from "react";

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

/* ─── Data ─── */
const budgetRows = [
  { category: "Materials", amount: 1350000, pct: 57.4, color: "#f59e0b" },
  { category: "Labor", amount: 680000, pct: 28.9, color: "#3b82f6" },
  { category: "Equipment", amount: 85000, pct: 3.6, color: "#8b5cf6" },
  { category: "Transportation", amount: 35000, pct: 1.5, color: "#10b981" },
  { category: "Permits & Fees", amount: 45000, pct: 1.9, color: "#f43f5e" },
  { category: "Other Expenses", amount: 25000, pct: 1.1, color: "#06b6d4" },
  { category: "Contingency (8%)", amount: 130000, pct: 5.5, color: "#6b7280" },
];

const materialRows = [
  { material: "Portland Cement", category: "Concrete", qty: 2400, unit: "bags", price: 280 },
  { material: "Steel Bars 10mm", category: "Structural", qty: 8000, unit: "kg", price: 68 },
  { material: "Steel Bars 12mm", category: "Structural", qty: 4000, unit: "kg", price: 72 },
  { material: "Sand (Washed)", category: "Aggregate", qty: 180, unit: "cu.m", price: 1200 },
  { material: "Gravel 3/4\"", category: "Aggregate", qty: 200, unit: "cu.m", price: 1400 },
  { material: "CHB 4\" Hollow Blocks", category: "Masonry", qty: 4200, unit: "pcs", price: 18 },
  { material: "Lumber 2x3", category: "Carpentry", qty: 600, unit: "pcs", price: 280 },
  { material: "Metal Roofing (Long Span)", category: "Roofing", qty: 140, unit: "sheets", price: 650 },
  { material: "Electrical Materials", category: "Electrical", qty: 1, unit: "lot", price: 85000 },
  { material: "Plumbing Materials", category: "Plumbing", qty: 1, unit: "lot", price: 65000 },
  { material: "Paint (Int./Ext.)", category: "Finishing", qty: 80, unit: "gal", price: 650 },
  { material: "Floor Tiles 600×600", category: "Finishing", qty: 160, unit: "sqm", price: 480 },
];

const equipmentRows = [
  { name: "Concrete Mixer (350L)", qty: 3, duration: "6 months", cost: 18000, phase: "Foundation, Structural, Walls" },
  { name: "Scaffolding Set", qty: 2, duration: "4 months", cost: 24000, phase: "Structural, Walls, Finishing" },
  { name: "Welding Machine", qty: 1, duration: "2 months", cost: 8000, phase: "Structural Works" },
  { name: "Bar Cutter & Bender", qty: 1, duration: "3 months", cost: 9000, phase: "Foundation, Structural" },
  { name: "Electric Hand Drill ×3", qty: 3, duration: "Full project", cost: 4500, phase: "All Phases" },
  { name: "Dump Truck (3 trips)", qty: 1, duration: "3 trips", cost: 6000, phase: "Site Preparation" },
  { name: "Transit Mixer 6 cu.m", qty: 1, duration: "3 deliveries", cost: 9000, phase: "Foundation, Slab" },
  { name: "Hand Tools & PPE", qty: 1, duration: "Full project", cost: 6500, phase: "All Phases" },
];

const phases = [
  { name: "Foundation", pct: 100, color: "#10b981" },
  { name: "Structural Works", pct: 80, color: "#f59e0b" },
  { name: "Walls & Masonry", pct: 60, color: "#f59e0b" },
  { name: "Roofing", pct: 30, color: "#3b82f6" },
  { name: "Electrical", pct: 10, color: "#3b82f6" },
  { name: "Plumbing", pct: 10, color: "#3b82f6" },
  { name: "Finishing", pct: 0, color: "#374151" },
];

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
function PlanCard({ onNext }: { onNext: (reply: string) => void }) {
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const items = [
    { icon: "📅", title: "Timeline", value: "8 months", detail: "Mar 1 – Nov 1, 2026 · 32 weeks", color: "#3b82f6" },
    { icon: "₱", title: "AI Budget Estimate", value: "₱2,350,000", detail: "Within budget · ₱150K buffer", color: "#f59e0b" },
    { icon: "🧱", title: "Key Materials", value: "12 material types", detail: "Cement, steel, CHB, roofing…", color: "#10b981" },
    { icon: "👷", title: "Workforce", value: "21 workers", detail: "Foreman, Carpenters, Masons…", color: "#8b5cf6" },
    { icon: "🚧", title: "Equipment", value: "8 equipment types", detail: "Mixers, scaffolding, tools…", color: "#f43f5e" },
    { icon: "📐", title: "Phases", value: "7 phases", detail: "Foundation → Finishing", color: "#06b6d4" },
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
              <div className="text-xs mt-0.5" style={{ color: "#6b7280" }}>{item.detail}</div>
            </div>
            {approved[item.title] && <span className="text-xs" style={{ color: item.color }}>✓</span>}
          </div>
        ))}
      </div>
      <div className="px-4 pb-4 flex gap-2">
        {allApproved
          ? <button onClick={() => onNext("Show me the detailed budget breakdown")} className="w-full py-2.5 rounded-xl text-sm font-700 hover:opacity-90 transition-all" style={{ background: "#f59e0b", color: "#0f1117" }}>Continue to Budget Breakdown →</button>
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
function BudgetCard({ onNext }: { onNext: (reply: string) => void }) {
  const allowable = 2500000;
  const estimate = 2350000;
  const buffer = allowable - estimate;
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#1e2235", border: "1px solid #2a2f42" }}>
      <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "#2a2f42", background: "#252a3a" }}>
        <SectionHeader icon="₱" title="Budget Breakdown" badge="AI Estimate" />
      </div>
      <div className="p-4">
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: "Your Budget", value: `₱${(allowable / 1000000).toFixed(1)}M`, color: "#9ca3af" },
            { label: "AI Estimate", value: `₱${(estimate / 1000000).toFixed(2)}M`, color: "#f59e0b" },
            { label: "Buffer", value: `₱${(buffer / 1000).toFixed(0)}K`, color: "#10b981" },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-3 rounded-xl text-center" style={{ background: "#252a3a" }}>
              <div className="text-xs mb-1" style={{ color: "#6b7280" }}>{label}</div>
              <div className="font-700 mono text-base" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>
        <div className="space-y-2 mb-4">
          {budgetRows.map(({ category, amount, pct, color }) => (
            <div key={category}>
              <div className="flex justify-between text-xs mb-1">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: color }} /><span style={{ color: "#9ca3af" }}>{category}</span></div>
                <div className="flex gap-3"><span className="mono" style={{ color: "#6b7280" }}>{pct}%</span><span className="mono font-500" style={{ color: "#f0f2f5" }}>₱{amount.toLocaleString()}</span></div>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: "#2a2f42" }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => onNext("Looks good, show me the material list")} className="flex-1 py-2.5 rounded-xl text-sm font-700 hover:opacity-90" style={{ background: "#f59e0b", color: "#0f1117" }}>✓ Approve Budget · Next →</button>
          <button className="px-4 py-2.5 rounded-xl text-sm font-500" style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42" }}>Modify</button>
        </div>
      </div>
    </div>
  );
}

/* ── MATERIALS CARD ── */
function MaterialsCard({ onNext }: { onNext: (reply: string) => void }) {
  const [approved, setApproved] = useState<Record<number, boolean>>({});
  const total = materialRows.reduce((s, m) => s + m.qty * m.price, 0);
  const allApproved = materialRows.every((_, i) => approved[i]);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#1e2235", border: "1px solid #2a2f42" }}>
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "#2a2f42", background: "#252a3a" }}>
        <SectionHeader icon="🧱" title="Material Estimates" badge="AI Generated" />
        <span className="mono text-sm font-700" style={{ color: "#f59e0b" }}>₱{total.toLocaleString()}</span>
      </div>
      <div className="px-4 py-2" style={{ maxHeight: 280, overflowY: "auto" }}>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #2a2f42" }}>
          <table className="w-full text-xs">
            <thead><tr style={{ borderBottom: "1px solid #2a2f42", background: "#252a3a" }}>
              {["Material", "Qty", "Unit", "Price", "Total", ""].map(h => <th key={h} className="text-left px-3 py-2 font-600" style={{ color: "#6b7280" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {materialRows.map((m, i) => (
                <tr key={i} className="border-b" style={{ borderColor: "#1e2235", background: approved[i] ? "#10b98108" : "transparent" }}>
                  <td className="px-3 py-2 font-500" style={{ color: "#f0f2f5" }}>{m.material}</td>
                  <td className="px-3 py-2 mono" style={{ color: "#9ca3af" }}>{m.qty.toLocaleString()}</td>
                  <td className="px-3 py-2" style={{ color: "#6b7280" }}>{m.unit}</td>
                  <td className="px-3 py-2 mono" style={{ color: "#9ca3af" }}>₱{m.price.toLocaleString()}</td>
                  <td className="px-3 py-2 mono font-600" style={{ color: "#f59e0b" }}>₱{(m.qty * m.price).toLocaleString()}</td>
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
          <button onClick={() => { setApproved(Object.fromEntries(materialRows.map((_, i) => [i, true]))); }} className="flex-1 py-2.5 rounded-xl text-sm font-600 hover:opacity-90" style={{ background: allApproved ? "#252a3a" : "#f59e0b15", color: allApproved ? "#9ca3af" : "#f59e0b", border: "1px solid #f59e0b30" }}>
            {allApproved ? "All Approved ✓" : "✓ Approve All Materials"}
          </button>
          {allApproved && <button onClick={() => onNext("Great, show me the equipment needed")} className="flex-1 py-2.5 rounded-xl text-sm font-700 hover:opacity-90" style={{ background: "#f59e0b", color: "#0f1117" }}>Next: Equipment →</button>}
        </div>
      </div>
    </div>
  );
}

/* ── EQUIPMENT CARD ── */
function EquipmentCard({ onNext }: { onNext: (reply: string) => void }) {
  const [approved, setApproved] = useState(false);
  const total = equipmentRows.reduce((s, e) => s + e.cost, 0);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#1e2235", border: "1px solid #2a2f42" }}>
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "#2a2f42", background: "#252a3a" }}>
        <SectionHeader icon="🚧" title="Equipment Requirements" badge="AI Generated" />
        <span className="mono text-sm font-700" style={{ color: "#f59e0b" }}>₱{total.toLocaleString()}</span>
      </div>
      <div className="px-4 py-3" style={{ maxHeight: 260, overflowY: "auto" }}>
        <div className="space-y-1.5">
          {equipmentRows.map((e, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: "#252a3a" }}>
              <span className="text-base">🔧</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-500" style={{ color: "#f0f2f5" }}>{e.name}</div>
                <div className="text-xs" style={{ color: "#6b7280" }}>{e.phase} · {e.duration}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="mono text-xs font-600" style={{ color: "#f59e0b" }}>₱{e.cost.toLocaleString()}</div>
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
          {approved && <button onClick={() => onNext("Now show me the AI conceptual design")} className="flex-1 py-2.5 rounded-xl text-sm font-700 hover:opacity-90" style={{ background: "#f59e0b", color: "#0f1117" }}>Next: Design →</button>}
        </div>
      </div>
    </div>
  );
}

/* ── DESIGN CARD ── */
function DesignCard({ onNext }: { onNext: (reply: string) => void }) {
  const [approved, setApproved] = useState(false);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#1e2235", border: "1px solid #2a2f42" }}>
      <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "#2a2f42", background: "#252a3a" }}>
        <SectionHeader icon="📐" title="AI Conceptual Design" badge="AI Generated" />
        {approved && <span className="ml-auto text-xs font-600 px-2 py-0.5 rounded-full" style={{ background: "#10b98120", color: "#10b981" }}>Approved</span>}
      </div>
      {/* SVG floor plan */}
      <div className="p-4">
        <div className="rounded-xl overflow-hidden mb-4" style={{ background: "#0f1117", border: "1px solid #2a2f42" }}>
          <svg viewBox="0 0 720 380" className="w-full" style={{ maxHeight: 260 }}>
            {Array.from({ length: 19 }).map((_, i) => <line key={`v${i}`} x1={i * 40} y1={0} x2={i * 40} y2={380} stroke="#1e2235" strokeWidth="0.5" />)}
            {Array.from({ length: 10 }).map((_, i) => <line key={`h${i}`} x1={0} y1={i * 40} x2={720} y2={i * 40} stroke="#1e2235" strokeWidth="0.5" />)}
            <rect x="60" y="30" width="600" height="320" fill="none" stroke="#f59e0b" strokeWidth="2" rx="3" />
            <rect x="60" y="30" width="190" height="180" fill="#f59e0b06" stroke="#f59e0b50" strokeWidth="1" />
            <text x="155" y="122" textAnchor="middle" fill="#f59e0b" fontSize="11" fontWeight="600">LIVING ROOM</text>
            <text x="155" y="138" textAnchor="middle" fill="#6b7280" fontSize="9">5m × 4.5m</text>
            <rect x="250" y="30" width="180" height="180" fill="#3b82f606" stroke="#3b82f650" strokeWidth="1" />
            <text x="340" y="122" textAnchor="middle" fill="#3b82f6" fontSize="11" fontWeight="600">DINING / KITCHEN</text>
            <text x="340" y="138" textAnchor="middle" fill="#6b7280" fontSize="9">4.5m × 4.5m</text>
            <rect x="430" y="30" width="230" height="180" fill="#10b98106" stroke="#10b98150" strokeWidth="1" />
            <text x="545" y="115" textAnchor="middle" fill="#10b981" fontSize="11" fontWeight="600">MASTER BEDROOM</text>
            <text x="545" y="131" textAnchor="middle" fill="#6b7280" fontSize="9">5.75m × 4.5m</text>
            <rect x="60" y="210" width="190" height="140" fill="#8b5cf606" stroke="#8b5cf650" strokeWidth="1" />
            <text x="155" y="283" textAnchor="middle" fill="#8b5cf6" fontSize="11" fontWeight="600">BEDROOM 2</text>
            <text x="155" y="299" textAnchor="middle" fill="#6b7280" fontSize="9">4.75m × 3.5m</text>
            <rect x="250" y="210" width="150" height="140" fill="#06b6d406" stroke="#06b6d450" strokeWidth="1" />
            <text x="325" y="283" textAnchor="middle" fill="#06b6d4" fontSize="11" fontWeight="600">BEDROOM 3</text>
            <text x="325" y="299" textAnchor="middle" fill="#6b7280" fontSize="9">3.75m × 3.5m</text>
            <rect x="400" y="210" width="110" height="140" fill="#f43f5e06" stroke="#f43f5e50" strokeWidth="1" />
            <text x="455" y="283" textAnchor="middle" fill="#f43f5e" fontSize="10" fontWeight="600">BATHROOM</text>
            <text x="455" y="299" textAnchor="middle" fill="#6b7280" fontSize="9">2.75m × 3.5m</text>
            <rect x="510" y="210" width="150" height="140" fill="#fbbf2406" stroke="#fbbf2450" strokeWidth="1" />
            <text x="585" y="283" textAnchor="middle" fill="#fbbf24" fontSize="11" fontWeight="600">GARAGE</text>
            <text x="585" y="299" textAnchor="middle" fill="#6b7280" fontSize="9">3.75m × 3.5m</text>
            <text x="360" y="368" textAnchor="middle" fill="#374151" fontSize="9">AI-GENERATED GROUND FLOOR PLAN · FOR CONCEPTUAL REFERENCE ONLY</text>
          </svg>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { label: "Exterior", value: "Modern flat roof · White plaster · Wood accent facade" },
            { label: "Interior", value: "Open-plan living/dining · Neutral tones · High ceilings" },
            { label: "Floor Area", value: "120 sqm · 2 floors · 3BR / 2 bath" },
            { label: "Design Style", value: "Contemporary Modern" },
          ].map(({ label, value }) => (
            <div key={label} className="px-3 py-2 rounded-lg" style={{ background: "#252a3a" }}>
              <div className="text-xs mb-0.5" style={{ color: "#6b7280" }}>{label}</div>
              <div className="text-xs font-500" style={{ color: "#f0f2f5" }}>{value}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setApproved(true)} className="flex-1 py-2.5 rounded-xl text-sm font-600 hover:opacity-90" style={{ background: approved ? "#10b98120" : "#f59e0b15", color: approved ? "#10b981" : "#f59e0b", border: `1px solid ${approved ? "#10b98130" : "#f59e0b30"}` }}>
            {approved ? "✓ Design Approved" : "Approve Design"}
          </button>
          <button className="px-4 py-2.5 rounded-xl text-sm font-500" style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42" }}>✏ Modify</button>
          <button className="px-4 py-2.5 rounded-xl text-sm font-500" style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42" }}>⟳ Regen</button>
          {approved && <button onClick={() => onNext("Everything looks great. Finalize my project plan.")} className="flex-1 py-2.5 rounded-xl text-sm font-700 hover:opacity-90" style={{ background: "#f59e0b", color: "#0f1117" }}>Finalize →</button>}
        </div>
      </div>
    </div>
  );
}

/* ── SUMMARY CARD ── */
function SummaryCard() {
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
          {[
            { label: "Construction Plan", status: "Approved", color: "#10b981" },
            { label: "Budget Breakdown", status: "Approved", color: "#10b981" },
            { label: "Material Estimates", status: "Approved", color: "#10b981" },
            { label: "Equipment Plan", status: "Approved", color: "#10b981" },
            { label: "Conceptual Design", status: "Approved", color: "#10b981" },
          ].map(({ label, status, color }) => (
            <div key={label} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "#252a3a" }}>
              <span className="text-sm" style={{ color: "#9ca3af" }}>{label}</span>
              <span className="text-xs font-600" style={{ color }}>✓ {status}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="p-3 rounded-xl text-center" style={{ background: "#252a3a" }}>
            <div className="text-xs mb-1" style={{ color: "#6b7280" }}>Total AI Estimate</div>
            <div className="font-700 mono text-base" style={{ color: "#f59e0b" }}>₱2,350,000</div>
          </div>
          <div className="p-3 rounded-xl text-center" style={{ background: "#252a3a" }}>
            <div className="text-xs mb-1" style={{ color: "#6b7280" }}>Project Duration</div>
            <div className="font-700 text-base" style={{ color: "#3b82f6" }}>8 months</div>
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

/* ─── Phase progress bars ─── */
function PhaseBar() {
  return (
    <div className="rounded-xl p-3" style={{ background: "#252a3a", border: "1px solid #2a2f42" }}>
      <div className="text-xs font-600 mb-2" style={{ color: "#9ca3af" }}>CONSTRUCTION PHASES</div>
      <div className="space-y-1.5">
        {phases.map(({ name, pct, color }) => (
          <div key={name}>
            <div className="flex justify-between text-xs mb-1" style={{ color: "#6b7280" }}><span>{name}</span><span className="mono">{pct}%</span></div>
            <div className="h-1.5 rounded-full" style={{ background: "#1e2235" }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
            </div>
          </div>
        ))}
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

/* ─── FLOW STEPS ─── */
interface Step {
  delay: number;
  text: string;
  card?: CardType;
  quickReplies?: string[];
}

const INTRO_FLOW: Step[] = [
  { delay: 900, text: "Got it! Analyzing your project details..." },
  { delay: 2200, text: "I've processed your requirements. Here's your full AI construction plan. Review and approve each section — only approved items will be shared with contractors." },
];

const PLAN_FLOW: Step[] = [
  { delay: 700, text: "Here's a complete overview of your construction plan. Approve all sections or review them individually.", card: "plan" },
];

const BUDGET_FLOW: Step[] = [
  { delay: 900, text: "Your AI budget breakdown is ready. Your ₱2.5M budget comfortably covers the estimated ₱2.35M cost with ₱150K buffer.", card: "budget" },
];

const MATERIAL_FLOW: Step[] = [
  { delay: 900, text: "Here are the AI-estimated material requirements. Prices are based on current market data — review and approve each item.", card: "materials" },
];

const EQUIPMENT_FLOW: Step[] = [
  { delay: 900, text: "Here's the recommended equipment list with estimated rental/usage costs per construction phase.", card: "equipment" },
];

const DESIGN_FLOW: Step[] = [
  { delay: 1200, text: "Here's your AI-generated conceptual floor plan and design concept for a modern 3-bedroom, 2-bathroom house.", card: "design" },
];

const SUMMARY_FLOW: Step[] = [
  { delay: 800, text: "All sections are approved! 🎉 Your complete construction plan is ready. You can now search for contractors who will receive your approved plan.", card: "summary" },
];

const SUGGESTIONS = [
  "3-bedroom house, 120 sqm, modern design, Quezon City, ₱2.5M budget",
  "Two-story commercial building, 200 sqm, Makati, ₱5M budget",
  "Apartment renovation, 80 sqm, Pasig City, ₱800K budget",
  "Restaurant build-out, 60 sqm, BGC, ₱1.2M budget",
];

/* ─── Message renderer ─── */
function AIBubble({ msg, onUserReply }: { msg: ChatMessage; onUserReply: (text: string) => void }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 mt-0.5" style={{ background: "#f59e0b20" }}>🤖</div>
      <div className="flex-1 min-w-0 space-y-2">
        {msg.typing
          ? <div className="rounded-2xl rounded-tl-sm inline-block" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}><Dots /></div>
          : <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed inline-block max-w-full" style={{ background: "#1a1d27", border: "1px solid #2a2f42", color: "#e8eaed", whiteSpace: "pre-line" }}>{msg.text}</div>
        }
        {!msg.typing && msg.card === "plan" && <PlanCard onNext={t => onUserReply(t)} />}
        {!msg.typing && msg.card === "budget" && <BudgetCard onNext={t => onUserReply(t)} />}
        {!msg.typing && msg.card === "materials" && <MaterialsCard onNext={t => onUserReply(t)} />}
        {!msg.typing && msg.card === "equipment" && <EquipmentCard onNext={t => onUserReply(t)} />}
        {!msg.typing && msg.card === "design" && <DesignCard onNext={t => onUserReply(t)} />}
        {!msg.typing && msg.card === "summary" && <SummaryCard />}
        {!msg.typing && msg.quickReplies && (
          <div className="flex flex-wrap gap-2">
            {msg.quickReplies.map(r => <Chip key={r} text={r} onClick={() => onUserReply(r)} />)}
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

/* ─── Stage machine ─── */
type Stage = "idle" | "intro" | "plan" | "budget" | "materials" | "equipment" | "design" | "summary";

export default function ProjectChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: nextId(), role: "ai",
    text: "Hello! I'm your AI Construction Planner. Describe your project and I'll generate a complete plan — timeline, budget, materials, equipment, and conceptual design — all in one conversation.\n\nYou can type naturally, like: \"3-bedroom house in Quezon City, 120 sqm, ₱2.5M budget, modern design.\"",
    quickReplies: ["Residential house", "Renovation project", "Commercial building", "Two-story apartment"],
  }]);
  const [input, setInput] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const addTyping = () => {
    const id = nextId();
    setMessages(p => [...p, { id, role: "ai", text: "", typing: true }]);
    return id;
  };

  const resolveTyping = (id: number, update: Partial<ChatMessage>) => {
    setMessages(p => p.map(m => m.id === id ? { ...m, ...update, typing: false } : m));
  };

  const runSteps = (steps: Step[], onDone?: () => void) => {
    setBusy(true);
    let acc = 0;
    steps.forEach((step, i) => {
      acc += step.delay;
      const tid = nextId();
      setTimeout(() => setMessages(p => [...p, { id: tid, role: "ai", text: "", typing: true }]), acc - step.delay + 400);
      setTimeout(() => {
        setMessages(p => p.map(m => m.id === tid ? { ...m, text: step.text, card: step.card, quickReplies: step.quickReplies, typing: false } : m));
        if (i === steps.length - 1) { setBusy(false); onDone?.(); }
      }, acc);
    });
  };

  const handleUserSend = (text: string) => {
    if (!text.trim() || busy) return;
    const userMsg: ChatMessage = { id: nextId(), role: "user", text: text.trim() };
    setMessages(p => [...p, userMsg]);
    setInput("");
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }

    if (stage === "idle") {
      setStage("intro");
      runSteps(INTRO_FLOW, () => {
        setStage("plan");
        runSteps(PLAN_FLOW);
      });
    } else if (text.toLowerCase().includes("budget") || stage === "plan") {
      setStage("budget");
      runSteps(BUDGET_FLOW);
    } else if (text.toLowerCase().includes("material") || stage === "budget") {
      setStage("materials");
      runSteps(MATERIAL_FLOW);
    } else if (text.toLowerCase().includes("equipment") || stage === "materials") {
      setStage("equipment");
      runSteps(EQUIPMENT_FLOW);
    } else if (text.toLowerCase().includes("design") || stage === "equipment") {
      setStage("design");
      runSteps(DESIGN_FLOW);
    } else if (text.toLowerCase().includes("finalize") || stage === "design") {
      setStage("summary");
      runSteps(SUMMARY_FLOW);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleUserSend(input); }
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
          <button onClick={() => { setMessages([{ id: nextId(), role: "ai", text: "Hello! I'm your AI Construction Planner. Describe your project and I'll generate a complete plan — timeline, budget, materials, equipment, and conceptual design — all in one conversation.", quickReplies: ["Residential house", "Renovation project", "Commercial building", "Two-story apartment"] }]); setStage("idle"); }} className="px-3 py-1.5 rounded-lg text-xs font-500" style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42" }}>⟳ New Chat</button>
          <button className="px-3 py-1.5 rounded-lg text-xs font-500" style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42" }}>✓ Approval Center</button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {messages.map(msg =>
          msg.role === "ai"
            ? <AIBubble key={msg.id} msg={msg} onUserReply={handleUserSend} />
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
              <button key={s} onClick={() => handleUserSend(s)} disabled={busy} className="text-left px-3 py-2.5 rounded-xl text-xs transition-all hover:scale-[1.01]" style={{ background: "#1a1d27", border: "1px solid #2a2f42", color: "#9ca3af" }}
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
          <button onClick={() => handleUserSend(input)} disabled={!input.trim() || busy} className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all" style={{ background: input.trim() && !busy ? "#f59e0b" : "#252a3a" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke={input.trim() && !busy ? "#0f1117" : "#6b7280"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
        <p className="text-xs text-center mt-2" style={{ color: "#2a2f42" }}>AI recommends · You decide · All items require your approval</p>
      </div>

      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-5px);opacity:1} }`}</style>
    </div>
  );
}
