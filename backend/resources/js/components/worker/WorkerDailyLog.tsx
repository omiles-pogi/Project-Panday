import { useState } from "react";

export default function WorkerDailyLog() {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="px-4 pt-8 pb-24">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4" style={{ background: "#10b98120" }}>✓</div>
          <h2 className="text-2xl font-700 mb-2" style={{ color: "#f0f2f5" }}>Work Log Submitted</h2>
          <p className="text-sm mb-4" style={{ color: "#6b7280" }}>Your daily work log has been sent to your foreman for verification. AI has updated the project progress estimate.</p>
          <div className="rounded-xl p-4 text-left mb-4" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
            <div className="text-xs font-600 mb-2" style={{ color: "#f59e0b" }}>🤖 AI ACKNOWLEDGMENT</div>
            <p className="text-xs leading-relaxed" style={{ color: "#9ca3af" }}>Your log has been recorded. The AI has noted 62 hollow blocks laid today, updating the Walls phase from 58% to 60% completion. Keep up the pace!</p>
          </div>
          <button onClick={() => setSubmitted(false)} className="px-6 py-2.5 rounded-lg font-600 text-sm" style={{ background: "#f59e0b", color: "#0f1117" }}>Log Another Day</button>
        </div>
      </div>
    );
  }

  return (
    <div className="scroll-area">
      <div className="px-4 pt-4 pb-24 max-w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-700 mb-1" style={{ color: "#f0f2f5" }}>Daily Work Log</h1>
          <p className="text-sm" style={{ color: "#6b7280" }}>Record today's completed work. Submitted logs are verified by your foreman.</p>
        </div>

        <div className="space-y-5">
          {/* Date & Project */}
          <div className="rounded-xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
            <h2 className="font-600 text-sm mb-4 pb-3 border-b" style={{ color: "#f0f2f5", borderColor: "#2a2f42" }}>Work Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date" type="date" />
              <div>
                <label className="block text-xs font-500 mb-2" style={{ color: "#9ca3af" }}>Project</label>
                <select className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: "#252a3a", border: "1px solid #2a2f42", color: "#f0f2f5" }}>
                  <option>Dela Cruz Residence</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-500 mb-2" style={{ color: "#9ca3af" }}>Construction Phase</label>
                <select className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: "#252a3a", border: "1px solid #2a2f42", color: "#f0f2f5" }}>
                  <option>Structural Works</option>
                  <option>Walls & Masonry</option>
                  <option>Foundation</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-500 mb-2" style={{ color: "#9ca3af" }}>Work Area</label>
                <input placeholder="e.g. East wing, 2nd floor" className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: "#252a3a", border: "1px solid #2a2f42", color: "#f0f2f5" }} onFocus={e => (e.target.style.borderColor = "#f59e0b")} onBlur={e => (e.target.style.borderColor = "#2a2f42")} />
              </div>
            </div>
          </div>

          {/* Time */}
          <div className="rounded-xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
            <h2 className="font-600 text-sm mb-4 pb-3 border-b" style={{ color: "#f0f2f5", borderColor: "#2a2f42" }}>Time & Attendance</h2>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Time In" type="time" />
              <Field label="Time Out" type="time" />
              <Field label="Break (minutes)" type="number" placeholder="e.g. 60" />
            </div>
          </div>

          {/* Work done */}
          <div className="rounded-xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
            <h2 className="font-600 text-sm mb-4 pb-3 border-b" style={{ color: "#f0f2f5", borderColor: "#2a2f42" }}>Work Accomplished</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-500 mb-2" style={{ color: "#9ca3af" }}>Description of Work Done</label>
                <textarea rows={4} placeholder="e.g. Laid 62 hollow blocks on the east wall, 2nd floor. Mixed 8 batches of mortar. Removed forms from 3 columns." className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none" style={{ background: "#252a3a", border: "1px solid #2a2f42", color: "#f0f2f5" }} onFocus={e => (e.target.style.borderColor = "#f59e0b")} onBlur={e => (e.target.style.borderColor = "#2a2f42")} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Materials Used" placeholder="e.g. 62 CHB, 8 bags cement" />
                <Field label="Tools / Equipment Used" placeholder="e.g. Masonry tools, level" />
              </div>
              <div>
                <label className="block text-xs font-500 mb-2" style={{ color: "#9ca3af" }}>Issues / Observations (optional)</label>
                <textarea rows={2} placeholder="Any safety concerns, material shortages, or blockers..." className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none" style={{ background: "#252a3a", border: "1px solid #2a2f42", color: "#f0f2f5" }} onFocus={e => (e.target.style.borderColor = "#f59e0b")} onBlur={e => (e.target.style.borderColor = "#2a2f42")} />
              </div>
              <div>
                <label className="block text-xs font-500 mb-2" style={{ color: "#9ca3af" }}>Progress Photos (optional)</label>
                <div className="border-2 border-dashed rounded-lg p-5 text-center" style={{ borderColor: "#2a2f42" }}>
                  <div className="text-2xl mb-1">📷</div>
                  <p className="text-xs" style={{ color: "#9ca3af" }}>Upload photos of completed work</p>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setSubmitted(true)}
            className="w-full py-4 rounded-xl font-700 text-base hover:opacity-90 transition-all"
            style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#0f1117" }}
          >
            SUBMIT DAILY WORK LOG
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
