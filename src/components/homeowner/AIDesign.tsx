import { useState } from "react";

export default function AIDesign() {
  const [approved, setApproved] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegenerate = () => {
    setLoading(true);
    setApproved(false);
    setTimeout(() => setLoading(false), 2000);
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
            <p className="text-sm mt-1" style={{ color: "#6b7280" }}>My House Construction · 120 sqm · 2 Floors · Modern Design</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleRegenerate} className="px-4 py-2 rounded-lg text-sm font-500" style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42" }}>⟳ Regenerate</button>
            <button className="px-4 py-2 rounded-lg text-sm font-500" style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42" }}>⬇ Download PDF</button>
          </div>
        </div>

        {/* Floor plan preview */}
        <div className="rounded-xl overflow-hidden mb-6" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "#2a2f42" }}>
            <h2 className="font-600 text-sm" style={{ color: "#f0f2f5" }}>Floor Plan & Layout</h2>
            {approved && <span className="px-2 py-0.5 rounded-full text-xs font-600" style={{ background: "#10b98120", color: "#10b981" }}>APPROVED</span>}
          </div>
          <div className="p-6">
            {/* SVG Floor plan */}
            <div className="w-full rounded-xl overflow-hidden" style={{ background: "#0f1117", border: "1px solid #2a2f42" }}>
              <svg viewBox="0 0 800 500" className="w-full" style={{ maxHeight: 400 }}>
                {/* Grid */}
                {Array.from({ length: 20 }).map((_, i) => (
                  <line key={`v${i}`} x1={i * 40} y1={0} x2={i * 40} y2={500} stroke="#1e2235" strokeWidth="0.5" />
                ))}
                {Array.from({ length: 13 }).map((_, i) => (
                  <line key={`h${i}`} x1={0} y1={i * 40} x2={800} y2={i * 40} stroke="#1e2235" strokeWidth="0.5" />
                ))}
                {/* Ground floor */}
                <rect x="80" y="60" width="640" height="380" fill="none" stroke="#f59e0b" strokeWidth="2.5" rx="4" />
                {/* Rooms */}
                <rect x="80" y="60" width="200" height="200" fill="#f59e0b08" stroke="#f59e0b60" strokeWidth="1" />
                <text x="180" y="165" textAnchor="middle" fill="#f59e0b" fontSize="12" fontWeight="600">LIVING ROOM</text>
                <text x="180" y="182" textAnchor="middle" fill="#6b7280" fontSize="10">6m × 5m</text>

                <rect x="280" y="60" width="200" height="200" fill="#3b82f608" stroke="#3b82f660" strokeWidth="1" />
                <text x="380" y="165" textAnchor="middle" fill="#3b82f6" fontSize="12" fontWeight="600">DINING / KITCHEN</text>
                <text x="380" y="182" textAnchor="middle" fill="#6b7280" fontSize="10">5m × 5m</text>

                <rect x="480" y="60" width="240" height="200" fill="#10b98108" stroke="#10b98160" strokeWidth="1" />
                <text x="600" y="157" textAnchor="middle" fill="#10b981" fontSize="12" fontWeight="600">MASTER BEDROOM</text>
                <text x="600" y="174" textAnchor="middle" fill="#6b7280" fontSize="10">6m × 5m</text>

                <rect x="80" y="260" width="200" height="180" fill="#8b5cf608" stroke="#8b5cf660" strokeWidth="1" />
                <text x="180" y="355" textAnchor="middle" fill="#8b5cf6" fontSize="12" fontWeight="600">BEDROOM 2</text>
                <text x="180" y="372" textAnchor="middle" fill="#6b7280" fontSize="10">5m × 4.5m</text>

                <rect x="280" y="260" width="160" height="180" fill="#06b6d408" stroke="#06b6d460" strokeWidth="1" />
                <text x="360" y="355" textAnchor="middle" fill="#06b6d4" fontSize="12" fontWeight="600">BEDROOM 3</text>
                <text x="360" y="372" textAnchor="middle" fill="#6b7280" fontSize="10">4m × 4.5m</text>

                <rect x="440" y="260" width="120" height="180" fill="#f43f5e08" stroke="#f43f5e60" strokeWidth="1" />
                <text x="500" y="345" textAnchor="middle" fill="#f43f5e" fontSize="11" fontWeight="600">BATHROOM</text>
                <text x="500" y="362" textAnchor="middle" fill="#6b7280" fontSize="10">3m × 4.5m</text>

                <rect x="560" y="260" width="160" height="180" fill="#fbbf2408" stroke="#fbbf2460" strokeWidth="1" />
                <text x="640" y="345" textAnchor="middle" fill="#fbbf24" fontSize="11" fontWeight="600">GARAGE</text>
                <text x="640" y="362" textAnchor="middle" fill="#6b7280" fontSize="10">4m × 4.5m</text>

                {/* Dimensions */}
                <text x="400" y="30" textAnchor="middle" fill="#6b7280" fontSize="11">16m</text>
                <line x1="80" y1="35" x2="720" y2="35" stroke="#6b7280" strokeWidth="0.5" markerEnd="url(#arrow)" />
                <text x="45" y="255" textAnchor="middle" fill="#6b7280" fontSize="11" transform="rotate(-90 45 255)">10m</text>

                {/* Label */}
                <text x="400" y="490" textAnchor="middle" fill="#374151" fontSize="10">AI-GENERATED GROUND FLOOR PLAN — FOR CONCEPTUAL REFERENCE ONLY</text>
              </svg>
            </div>
          </div>
        </div>

        {/* Design specs */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: "Total Floor Area", value: "120 sqm" },
            { label: "Number of Floors", value: "2 Floors" },
            { label: "Building Footprint", value: "60 sqm/floor" },
            { label: "Bedrooms", value: "3 Bedrooms" },
            { label: "Bathrooms", value: "2 Bathrooms" },
            { label: "Design Style", value: "Modern / Contemporary" },
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
            { label: "Exterior Design Concept", desc: "Modern flat roof with clean geometric lines. White smooth plaster finish with warm wood accents on the main facade. Large glass windows maximize natural light." },
            { label: "Interior Design Concept", desc: "Open-plan living and dining area. Neutral color palette with earth tones. Built-in storage solutions to maximize space efficiency. High ceilings on ground floor." },
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
          <button className="px-6 py-3 rounded-xl font-500 text-sm" style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42" }}>✏ Modify</button>
          <button onClick={handleRegenerate} className="px-6 py-3 rounded-xl font-500 text-sm" style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42" }}>⟳ Regenerate</button>
        </div>
      </div>
    </div>
  );
}
