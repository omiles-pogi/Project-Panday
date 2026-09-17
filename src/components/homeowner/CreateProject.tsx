interface CreateProjectProps {
  onNav: (s: string) => void;
}

const projectTypes = ["Residential House", "Renovation", "Restaurant", "Commercial Building", "Two-Story Building", "Apartment", "Other Project"];
const designs = ["Modern", "Contemporary", "Traditional", "Minimalist", "Colonial", "Industrial", "Other"];

export default function CreateProject({ onNav }: CreateProjectProps) {
  return (
    <div className="scroll-area">
      <div className="px-4 pt-4 pb-24 max-w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-700 mb-1" style={{ color: "#f0f2f5" }}>Create Construction Project</h1>
          <p className="text-sm" style={{ color: "#6b7280" }}>Fill in your project details. The AI will generate a comprehensive construction plan.</p>
        </div>

        <div className="space-y-5">
          {/* Basic Info */}
          <div className="rounded-xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
            <h2 className="font-600 text-sm mb-4 pb-3 border-b" style={{ color: "#f0f2f5", borderColor: "#2a2f42" }}>Basic Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Project Name" placeholder="e.g. My Dream House" />
              <div>
                <label className="block text-xs font-500 mb-2" style={{ color: "#9ca3af" }}>Project Type</label>
                <select className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: "#252a3a", border: "1px solid #2a2f42", color: "#f0f2f5" }}>
                  <option value="">Select type...</option>
                  {projectTypes.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <FormField label="Location / Address" placeholder="e.g. Quezon City, Metro Manila" full />
              <div className="sm:col-span-2">
                <label className="block text-xs font-500 mb-2" style={{ color: "#9ca3af" }}>Project Description</label>
                <textarea rows={3} placeholder="Describe your project goals, style preferences, and requirements..." className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none" style={{ background: "#252a3a", border: "1px solid #2a2f42", color: "#f0f2f5" }} onFocus={e => (e.target.style.borderColor = "#f59e0b")} onBlur={e => (e.target.style.borderColor = "#2a2f42")} />
              </div>
            </div>
          </div>

          {/* Technical Specs */}
          <div className="rounded-xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
            <h2 className="font-600 text-sm mb-4 pb-3 border-b" style={{ color: "#f0f2f5", borderColor: "#2a2f42" }}>Technical Specifications</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <FormField label="Building Size (sqm)" placeholder="e.g. 120" type="number" />
              <FormField label="Number of Floors" placeholder="e.g. 2" type="number" />
              <div>
                <label className="block text-xs font-500 mb-2" style={{ color: "#9ca3af" }}>Preferred Design</label>
                <select className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: "#252a3a", border: "1px solid #2a2f42", color: "#f0f2f5" }}>
                  <option value="">Select design...</option>
                  {designs.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div className="rounded-xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
            <h2 className="font-600 text-sm mb-4 pb-3 border-b" style={{ color: "#f0f2f5", borderColor: "#2a2f42" }}>Schedule & Budget</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <FormField label="Desired Start Date" type="date" />
              <FormField label="Target Completion" type="date" />
              <div>
                <label className="block text-xs font-500 mb-2" style={{ color: "#9ca3af" }}>Allowable Budget (₱)</label>
                <input type="number" placeholder="e.g. 2500000" className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: "#252a3a", border: "1px solid #2a2f42", color: "#f0f2f5" }} onFocus={e => (e.target.style.borderColor = "#f59e0b")} onBlur={e => (e.target.style.borderColor = "#2a2f42")} />
              </div>
            </div>
          </div>

          {/* Extras */}
          <div className="rounded-xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
            <h2 className="font-600 text-sm mb-4 pb-3 border-b" style={{ color: "#f0f2f5", borderColor: "#2a2f42" }}>Additional Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-500 mb-2" style={{ color: "#9ca3af" }}>Special Requirements</label>
                <textarea rows={3} placeholder="e.g. Typhoon-resistant structure, solar panels, disabled access ramps..." className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none" style={{ background: "#252a3a", border: "1px solid #2a2f42", color: "#f0f2f5" }} onFocus={e => (e.target.style.borderColor = "#f59e0b")} onBlur={e => (e.target.style.borderColor = "#2a2f42")} />
              </div>
              <div>
                <label className="block text-xs font-500 mb-2" style={{ color: "#9ca3af" }}>Reference Images</label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all hover:border-yellow-500" style={{ borderColor: "#2a2f42" }}>
                  <div className="text-3xl mb-2">📷</div>
                  <p className="text-sm font-500 mb-1" style={{ color: "#9ca3af" }}>Drag & drop images here</p>
                  <p className="text-xs" style={{ color: "#6b7280" }}>or click to browse. PNG, JPG, PDF up to 10MB</p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={() => onNav("ai-planner")}
            className="w-full py-4 rounded-xl font-700 text-base transition-all hover:opacity-90 flex items-center justify-center gap-3"
            style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#0f1117" }}
          >
            <span className="text-xl">🤖</span>
            GENERATE AI CONSTRUCTION PLAN
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, placeholder, type = "text", full }: { label: string; placeholder?: string; type?: string; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="block text-xs font-500 mb-2" style={{ color: "#9ca3af" }}>{label}</label>
      <input type={type} placeholder={placeholder} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: "#252a3a", border: "1px solid #2a2f42", color: "#f0f2f5" }} onFocus={e => (e.target.style.borderColor = "#f59e0b")} onBlur={e => (e.target.style.borderColor = "#2a2f42")} />
    </div>
  );
}
