import { useState } from "react";

const phases = ["Foundation", "Structural Works", "Walls & Masonry", "Roofing", "Electrical", "Plumbing", "Finishing"];

export default function ProgressReport() {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="px-4 pt-8 pb-24">
        <div className="max-w-lg text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4" style={{ background: "#10b98120" }}>✓</div>
          <h2 className="text-2xl font-700 mb-2" style={{ color: "#f0f2f5" }}>Progress Report Submitted</h2>
          <p className="text-sm mb-6" style={{ color: "#6b7280" }}>The AI is now analyzing your progress report and will generate an updated progress analysis.</p>
          <div className="rounded-xl p-5 text-left" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
            <div className="font-600 mb-3" style={{ color: "#f0f2f5" }}>🤖 AI Analysis Preview</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: "Previous Progress", value: "34%", color: "#9ca3af" },
                { label: "New Work Completed", value: "8%", color: "#3b82f6" },
                { label: "Current Progress", value: "42%", color: "#f59e0b" },
                { label: "Expected Progress", value: "48%", color: "#10b981" },
              ].map(({ label, value, color }) => (
                <div key={label} className="p-3 rounded-lg" style={{ background: "#252a3a" }}>
                  <div className="text-xs mb-1" style={{ color: "#6b7280" }}>{label}</div>
                  <div className="font-700 mono" style={{ color }}>{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 px-3 py-2 rounded-lg" style={{ background: "#f59e0b15", borderLeft: "3px solid #f59e0b" }}>
              <span className="font-600 text-sm" style={{ color: "#f59e0b" }}>Status: SLIGHTLY BEHIND SCHEDULE</span>
            </div>
          </div>
          <button onClick={() => setSubmitted(false)} className="mt-4 px-6 py-2.5 rounded-lg font-600 text-sm" style={{ background: "#f59e0b", color: "#0f1117" }}>Submit Another Report</button>
        </div>
      </div>
    );
  }

  return (
    <div className="scroll-area">
      <div className="px-4 pt-4 pb-24 max-w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-700 mb-1" style={{ color: "#f0f2f5" }}>Construction Progress Report</h1>
          <p className="text-sm" style={{ color: "#6b7280" }}>Submit a progress update for AI analysis and homeowner visibility.</p>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
            <h2 className="font-600 text-sm mb-4 pb-3 border-b" style={{ color: "#f0f2f5", borderColor: "#2a2f42" }}>Project & Phase</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-500 mb-2" style={{ color: "#9ca3af" }}>Project</label>
                <select className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: "#252a3a", border: "1px solid #2a2f42", color: "#f0f2f5" }}>
                  <option>Dela Cruz Residence</option>
                  <option>Santos Commercial Bldg</option>
                  <option>Garcia Renovation</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-500 mb-2" style={{ color: "#9ca3af" }}>Construction Phase</label>
                <select className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: "#252a3a", border: "1px solid #2a2f42", color: "#f0f2f5" }}>
                  {phases.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <Field label="Work Area" placeholder="e.g. East wing, 2nd floor columns" />
              <Field label="Report Date" type="date" />
            </div>
          </div>

          <div className="rounded-xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
            <h2 className="font-600 text-sm mb-4 pb-3 border-b" style={{ color: "#f0f2f5", borderColor: "#2a2f42" }}>Work Completed</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-500 mb-2" style={{ color: "#9ca3af" }}>Description of Completed Work</label>
                <textarea rows={4} placeholder="Describe all work completed during this period..." className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none" style={{ background: "#252a3a", border: "1px solid #2a2f42", color: "#f0f2f5" }} onFocus={e => (e.target.style.borderColor = "#f59e0b")} onBlur={e => (e.target.style.borderColor = "#2a2f42")} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Start Date" type="date" />
                <Field label="Completion Date" type="date" />
              </div>
            </div>
          </div>

          <div className="rounded-xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
            <h2 className="font-600 text-sm mb-4 pb-3 border-b" style={{ color: "#f0f2f5", borderColor: "#2a2f42" }}>Resources Used</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {["Workers Used (count)", "Materials Used", "Equipment Used"].map(label => (
                <div key={label}>
                  <label className="block text-xs font-500 mb-2" style={{ color: "#9ca3af" }}>{label}</label>
                  <input className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: "#252a3a", border: "1px solid #2a2f42", color: "#f0f2f5" }} onFocus={e => (e.target.style.borderColor = "#f59e0b")} onBlur={e => (e.target.style.borderColor = "#2a2f42")} />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
            <h2 className="font-600 text-sm mb-4 pb-3 border-b" style={{ color: "#f0f2f5", borderColor: "#2a2f42" }}>Expenses & Photos</h2>
            <div className="space-y-4">
              <Field label="Total Expenses (₱)" type="number" placeholder="e.g. 85000" />
              <div>
                <label className="block text-xs font-500 mb-2" style={{ color: "#9ca3af" }}>Progress Photos</label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center" style={{ borderColor: "#2a2f42" }}>
                  <div className="text-2xl mb-2">📷</div>
                  <p className="text-sm" style={{ color: "#9ca3af" }}>Upload progress photos</p>
                  <p className="text-xs mt-1" style={{ color: "#6b7280" }}>JPG, PNG up to 10MB each</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-500 mb-2" style={{ color: "#9ca3af" }}>Additional Notes</label>
                <textarea rows={3} placeholder="Any issues, challenges, or observations..." className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none" style={{ background: "#252a3a", border: "1px solid #2a2f42", color: "#f0f2f5" }} onFocus={e => (e.target.style.borderColor = "#f59e0b")} onBlur={e => (e.target.style.borderColor = "#2a2f42")} />
              </div>
            </div>
          </div>

          <button onClick={() => setSubmitted(true)} className="w-full py-4 rounded-xl font-700 text-base hover:opacity-90 transition-all" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#0f1117" }}>
            SUBMIT PROGRESS REPORT
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, placeholder, type = "text" }: { label: string; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-500 mb-2" style={{ color: "#9ca3af" }}>{label}</label>
      <input type={type} placeholder={placeholder} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: "#252a3a", border: "1px solid #2a2f42", color: "#f0f2f5" }} onFocus={e => (e.target.style.borderColor = "#f59e0b")} onBlur={e => (e.target.style.borderColor = "#2a2f42")} />
    </div>
  );
}
