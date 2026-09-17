import { useState } from "react";

const equipment = [
  { name: "Concrete Mixer (350L)", qty: 3, duration: "6 months", cost: 18000, phase: "Foundation, Structural, Walls" },
  { name: "Scaffolding Set", qty: 2, duration: "4 months", cost: 24000, phase: "Structural, Walls, Finishing" },
  { name: "Welding Machine", qty: 1, duration: "2 months", cost: 8000, phase: "Structural Works" },
  { name: "Bar Cutter & Bender", qty: 1, duration: "3 months", cost: 9000, phase: "Foundation, Structural" },
  { name: "Electric Hand Drill", qty: 3, duration: "Full project", cost: 4500, phase: "All Phases" },
  { name: "Dump Truck (3 trips)", qty: 1, duration: "3 trips", cost: 6000, phase: "Site Preparation" },
  { name: "Transit Mixer (6 cu.m)", qty: 1, duration: "3 deliveries", cost: 9000, phase: "Foundation, Slab" },
  { name: "Hand Tools & Others", qty: 1, duration: "Full project", cost: 6500, phase: "All Phases" },
];

export default function EquipmentEstimator() {
  const [data, setData] = useState(equipment.map(e => ({ ...e, approved: false })));
  const total = data.reduce((s, e) => s + e.cost, 0);

  const toggleApprove = (i: number) => {
    setData(prev => prev.map((e, idx) => idx === i ? { ...e, approved: !e.approved } : e));
  };

  return (
    <div className="scroll-area">
      <div className="px-4 pt-4 pb-24 max-w-full">
        <div className="mb-5">
          <span className="text-xs font-600 px-2 py-0.5 rounded-full" style={{ background: "#f59e0b20", color: "#f59e0b" }}>🤖 AI GENERATED</span>
          <h1 className="text-2xl font-700 mt-2 mb-1" style={{ color: "#f0f2f5" }}>Equipment Estimator</h1>
          <p className="text-sm" style={{ color: "#6b7280" }}>Equipment requirements · My House Construction</p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="p-4 rounded-xl text-center" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
            <div className="text-xs mb-1" style={{ color: "#6b7280" }}>Equipment Types</div>
            <div className="text-2xl font-700" style={{ color: "#f0f2f5" }}>{data.length}</div>
          </div>
          <div className="p-4 rounded-xl text-center" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
            <div className="text-xs mb-1" style={{ color: "#6b7280" }}>Total Units</div>
            <div className="text-2xl font-700" style={{ color: "#f0f2f5" }}>{data.reduce((s, e) => s + e.qty, 0)}</div>
          </div>
          <div className="p-4 rounded-xl text-center" style={{ background: "#1a1d27", border: "1px solid #f59e0b30" }}>
            <div className="text-xs mb-1" style={{ color: "#6b7280" }}>Total Cost</div>
            <div className="text-base font-700 mono" style={{ color: "#f59e0b" }}>₱{total.toLocaleString()}</div>
          </div>
        </div>

        <div className="space-y-2 mb-5">
          {data.map((e, i) => (
            <div key={i} className="rounded-xl px-4 py-3" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex-1 min-w-0">
                  <span className="font-600 text-sm" style={{ color: "#f0f2f5" }}>{e.name}</span>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <span className="text-xs" style={{ color: "#6b7280" }}>Qty: {e.qty}</span>
                    <span className="text-xs" style={{ color: "#6b7280" }}>{e.duration}</span>
                    <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: "#252a3a", color: "#9ca3af" }}>{e.phase}</span>
                  </div>
                </div>
                <span className="font-700 mono text-sm flex-shrink-0" style={{ color: "#f59e0b" }}>₱{e.cost.toLocaleString()}</span>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => toggleApprove(i)}
                  className="px-3 py-1 rounded-lg text-xs font-500 transition-all"
                  style={{ background: e.approved ? "#10b98120" : "#252a3a", color: e.approved ? "#10b981" : "#9ca3af", border: `1px solid ${e.approved ? "#10b98140" : "#2a2f42"}` }}
                >
                  {e.approved ? "✓ Approved" : "Approve"}
                </button>
                <button className="px-3 py-1 rounded-lg text-xs" style={{ background: "#252a3a", color: "#9ca3af" }}>Edit</button>
                <button className="px-3 py-1 rounded-lg text-xs" style={{ background: "#252a3a", color: "#ef4444" }}>✕</button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl px-4 py-3 flex justify-between items-center mb-5" style={{ background: "#f59e0b15", border: "1px solid #f59e0b30" }}>
          <span className="text-sm font-600" style={{ color: "#f0f2f5" }}>Estimated Total Equipment Cost</span>
          <span className="text-lg font-800 mono" style={{ color: "#f59e0b" }}>₱{total.toLocaleString()}</span>
        </div>

        <div className="flex gap-3">
          <button className="flex-1 py-3.5 rounded-xl font-700 text-sm" style={{ background: "#f59e0b", color: "#0f1117" }}>Approve Equipment Plan</button>
          <button className="px-5 py-3.5 rounded-xl font-500 text-sm" style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42" }}>Modify</button>
        </div>
      </div>
    </div>
  );
}
