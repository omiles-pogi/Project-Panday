const skills = [
  { name: "Masonry / Block Laying", level: "Expert", years: 8, pct: 95 },
  { name: "Concrete Form Works", level: "Advanced", years: 6, pct: 82 },
  { name: "Mortar Mixing & Application", level: "Expert", years: 8, pct: 93 },
  { name: "Plastering & Rendering", level: "Intermediate", years: 4, pct: 70 },
  { name: "Tile Setting (Floor/Wall)", level: "Intermediate", years: 3, pct: 60 },
  { name: "General Carpentry (Basic)", level: "Beginner", years: 1, pct: 30 },
];

const levelColor: Record<string, { color: string; bg: string }> = {
  Expert: { color: "#10b981", bg: "#10b98120" },
  Advanced: { color: "#3b82f6", bg: "#3b82f620" },
  Intermediate: { color: "#f59e0b", bg: "#f59e0b20" },
  Beginner: { color: "#6b7280", bg: "#25253a" },
};

export default function WorkerSkills() {
  return (
    <div className="scroll-area">
      <div className="px-4 pt-4 pb-24 max-w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-700 mb-1" style={{ color: "#f0f2f5" }}>Skills & Profile</h1>
          <p className="text-sm" style={{ color: "#6b7280" }}>Marco Aquino · Mason · Worker Profile</p>
        </div>

        {/* Profile card */}
        <div className="rounded-xl p-5 mb-6 flex gap-5 items-start" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <div className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-700 flex-shrink-0" style={{ background: "#f43f5e20", color: "#f43f5e", fontSize: 28 }}>MA</div>
          <div className="flex-1">
            <h2 className="text-xl font-700 mb-0.5" style={{ color: "#f0f2f5" }}>Marco Aquino</h2>
            <p className="text-sm mb-2" style={{ color: "#9ca3af" }}>Skilled Mason · 8 years experience · Quezon City</p>
            <div className="flex gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-xs font-600" style={{ background: "#10b98120", color: "#10b981" }}>✓ Verified Worker</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-600" style={{ background: "#f59e0b20", color: "#f59e0b" }}>⭐ 4.8 Rating</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-600" style={{ background: "#3b82f620", color: "#3b82f6" }}>142 Days Worked</span>
            </div>
          </div>
          <button className="px-3 py-1.5 rounded-lg text-xs font-500" style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42" }}>Edit Profile</button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { label: "Projects Done", value: "9", color: "#f0f2f5" },
            { label: "Total Hours", value: "1,136h", color: "#f59e0b" },
            { label: "On-time Rate", value: "94%", color: "#10b981" },
            { label: "Quality Score", value: "4.8/5", color: "#3b82f6" },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-3 rounded-xl text-center" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
              <div className="text-xs mb-1" style={{ color: "#6b7280" }}>{label}</div>
              <div className="font-700 mono" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Skills */}
        <div className="rounded-xl p-5 mb-6" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-600 text-sm" style={{ color: "#f0f2f5" }}>Skills Assessment</h2>
            <span className="text-xs" style={{ color: "#6b7280" }}>AI-assessed based on work history</span>
          </div>
          <div className="space-y-4">
            {skills.map(({ name, level, years, pct }) => {
              const lc = levelColor[level];
              return (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-500" style={{ color: "#f0f2f5" }}>{name}</span>
                      <span className="px-2 py-0.5 rounded text-xs font-500" style={{ background: lc.bg, color: lc.color }}>{level}</span>
                    </div>
                    <span className="text-xs" style={{ color: "#6b7280" }}>{years} yrs · {pct}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "#252a3a" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: lc.color }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 p-3 rounded-lg" style={{ background: "#f59e0b15", borderLeft: "3px solid #f59e0b" }}>
            <p className="text-xs" style={{ color: "#fbbf24" }}>
              🤖 <strong>AI Suggestion:</strong> Based on your masonry expertise, you qualify for senior mason roles. Improving your tile-setting skills could increase your daily rate by up to ₱150.
            </p>
          </div>
        </div>

        {/* Certifications */}
        <div className="rounded-xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-600 text-sm" style={{ color: "#f0f2f5" }}>Certifications & Training</h2>
            <button className="px-3 py-1 rounded text-xs font-500" style={{ background: "#f59e0b20", color: "#f59e0b" }}>+ Add Cert</button>
          </div>
          <div className="space-y-3">
            {[
              { name: "TESDA NC II — Masonry", issuer: "TESDA", year: "2019", valid: true },
              { name: "Construction Safety Officer Training", issuer: "DOLE", year: "2022", valid: true },
              { name: "PESO Skilled Worker Certificate", issuer: "PESO QC", year: "2021", valid: true },
            ].map(({ name, issuer, year, valid }) => (
              <div key={name} className="flex items-center justify-between px-4 py-3 rounded-lg" style={{ background: "#252a3a" }}>
                <div>
                  <div className="font-500 text-sm" style={{ color: "#f0f2f5" }}>{name}</div>
                  <div className="text-xs" style={{ color: "#6b7280" }}>{issuer} · {year}</div>
                </div>
                {valid && <span className="px-2 py-0.5 rounded text-xs font-500" style={{ background: "#10b98120", color: "#10b981" }}>✓ Valid</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
