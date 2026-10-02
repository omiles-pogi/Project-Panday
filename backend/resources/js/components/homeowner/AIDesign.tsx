import { useState } from "react";
import { usePlan } from "../../lib/ai/PlanContext";
import BriefPrompt from "./BriefPrompt";

export default function AIDesign() {
  const { plan, brief, loading, error, generate } = usePlan();
  const [approved, setApproved] = useState(false);

  if (!plan) {
    return (
      <div className="scroll-area">
        <div className="px-4 pt-4 pb-24 max-w-full">
          <div className="mb-5">
            <span className="text-xs font-600 px-2 py-0.5 rounded-full" style={{ background: "#f59e0b20", color: "#f59e0b" }}>🤖 AI-GENERATED CONCEPTUAL PLAN</span>
            <h1 className="text-2xl font-700 mt-2 mb-1" style={{ color: "#f0f2f5" }}>AI Design & Layout</h1>
          </div>
          <BriefPrompt onGenerate={generate} loading={loading} error={error} />
        </div>
      </div>
    );
  }

  const handleRegenerate = () => {
    if (!brief) return;
    setApproved(false);
    generate(brief);
  };

  return (
    <div className="scroll-area">
      <div className="px-4 pt-4 pb-24 max-w-full">
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-600 px-2 py-0.5 rounded-full" style={{ background: "#f59e0b20", color: "#f59e0b" }}>🤖 AI-GENERATED CONCEPTUAL PLAN</span>
            </div>
            <h1 className="text-2xl font-700" style={{ color: "#f0f2f5" }}>AI Design & Layout</h1>
            <p className="text-sm mt-1" style={{ color: "#6b7280" }}>{plan.projectTitle} · {plan.areaSqm} sqm · {plan.floors} Floor{plan.floors > 1 ? "s" : ""} · {plan.designStyle}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleRegenerate} disabled={loading} className="px-4 py-2 rounded-lg text-sm font-500" style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42", opacity: loading ? 0.6 : 1 }}>
              {loading ? "⟳ Regenerating…" : "⟳ Regenerate"}
            </button>
          </div>
        </div>

        {/* Floor plan preview */}
        <div className="rounded-xl overflow-hidden mb-6" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "#2a2f42" }}>
            <h2 className="font-600 text-sm" style={{ color: "#f0f2f5" }}>Floor Plan & Layout</h2>
            {approved && <span className="px-2 py-0.5 rounded-full text-xs font-600" style={{ background: "#10b98120", color: "#10b981" }}>APPROVED</span>}
          </div>
          <div className="p-6">
            <p className="text-xs mb-4" style={{ color: "#6b7280" }}>Detailed floor-plan rendering isn't wired to an image model yet — the layout below is a generic schematic for reference only.</p>
            <div className="w-full rounded-xl overflow-hidden" style={{ background: "#0f1117", border: "1px solid #2a2f42" }}>
              <svg viewBox="0 0 800 500" className="w-full" style={{ maxHeight: 320 }}>
                {Array.from({ length: 20 }).map((_, i) => (
                  <line key={`v${i}`} x1={i * 40} y1={0} x2={i * 40} y2={500} stroke="#1e2235" strokeWidth="0.5" />
                ))}
                {Array.from({ length: 13 }).map((_, i) => (
                  <line key={`h${i}`} x1={0} y1={i * 40} x2={800} y2={i * 40} stroke="#1e2235" strokeWidth="0.5" />
                ))}
                <rect x="80" y="60" width="640" height="380" fill="none" stroke="#f59e0b" strokeWidth="2.5" rx="4" />
                <text x="400" y="490" textAnchor="middle" fill="#374151" fontSize="10">GENERIC FLOOR PLAN SCHEMATIC — FOR CONCEPTUAL REFERENCE ONLY</text>
              </svg>
            </div>
          </div>
        </div>

        {/* Design specs */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: "Total Floor Area", value: `${plan.areaSqm} sqm` },
            { label: "Number of Floors", value: `${plan.floors} Floor${plan.floors > 1 ? "s" : ""}` },
            { label: "Bedrooms", value: `${plan.bedrooms} Bedroom${plan.bedrooms > 1 ? "s" : ""}` },
            { label: "Bathrooms", value: `${plan.bathrooms} Bathroom${plan.bathrooms > 1 ? "s" : ""}` },
            { label: "Design Style", value: plan.designStyle },
            { label: "Location", value: plan.location },
          ].map(({ label, value }) => (
            <div key={label} className="p-4 rounded-xl" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
              <div className="text-xs mb-1" style={{ color: "#6b7280" }}>{label}</div>
              <div className="font-600" style={{ color: "#f0f2f5" }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Exterior/Interior concepts */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {[
            { label: "Exterior Design Concept", desc: plan.exteriorConcept },
            { label: "Interior Design Concept", desc: plan.interiorConcept },
          ].map(({ label, desc }) => (
            <div key={label} className="rounded-xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
              <h3 className="font-600 text-sm mb-3" style={{ color: "#f0f2f5" }}>{label}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "#9ca3af" }}>{desc}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={() => setApproved(true)} className="flex-1 py-3 rounded-xl font-600 text-sm hover:opacity-90 transition-all" style={{ background: approved ? "#10b981" : "#f59e0b", color: "#0f1117" }}>
            {approved ? "✓ Design Approved" : "Approve Design"}
          </button>
          <button onClick={handleRegenerate} disabled={loading} className="px-6 py-3 rounded-xl font-500 text-sm" style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42", opacity: loading ? 0.6 : 1 }}>⟳ Regenerate</button>
        </div>
      </div>
    </div>
  );
}
