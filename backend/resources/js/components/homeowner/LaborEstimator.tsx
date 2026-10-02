import { useState } from "react";

type Worker = {
  type: string;
  qty: number;
  days: number;
  dailyRate: number;
  color: string;
  approved: boolean;
};

const initialWorkers: Worker[] = [
  { type: "Foreman", qty: 1, days: 240, dailyRate: 1200, color: "#f59e0b", approved: false },
  { type: "Carpenter", qty: 4, days: 160, dailyRate: 900, color: "#3b82f6", approved: false },
  { type: "Mason", qty: 3, days: 180, dailyRate: 850, color: "#8b5cf6", approved: false },
  { type: "Electrician", qty: 2, days: 60, dailyRate: 1000, color: "#10b981", approved: false },
  { type: "Plumber", qty: 2, days: 50, dailyRate: 1000, color: "#06b6d4", approved: false },
  { type: "Laborer", qty: 8, days: 200, dailyRate: 600, color: "#6b7280", approved: false },
  { type: "Painter", qty: 2, days: 30, dailyRate: 800, color: "#f43f5e", approved: false },
  { type: "Welder", qty: 1, days: 20, dailyRate: 1100, color: "#fbbf24", approved: false },
];

// Simulated labor profiles per trade
const laborProfiles: Record<string, Array<{
  name: string; age: number; city: string; rating: number; years: number;
  projects: number; availability: string; certifications: string[];
  skills: Array<{ name: string; pct: number }>;
}>> = {
  Foreman: [
    { name: "Roberto Cruz", age: 45, city: "Quezon City", rating: 4.9, years: 18, projects: 34, availability: "Available", certifications: ["PCAB Foreman License", "OSH Certificate"], skills: [{ name: "Site Management", pct: 95 }, { name: "Scheduling", pct: 90 }, { name: "Safety Compliance", pct: 92 }] },
    { name: "Emmanuel Santos", age: 52, city: "Pasig City", rating: 4.8, years: 22, projects: 41, availability: "Available in 2 wks", certifications: ["PCAB License", "DOLE Safety"], skills: [{ name: "Site Management", pct: 98 }, { name: "Scheduling", pct: 88 }, { name: "Team Leadership", pct: 97 }] },
  ],
  Mason: [
    { name: "Marco Aquino", age: 34, city: "Quezon City", rating: 4.8, years: 8, projects: 9, availability: "Available", certifications: ["TESDA NC II — Masonry", "Construction Safety"], skills: [{ name: "Block Laying", pct: 95 }, { name: "Plastering", pct: 70 }, { name: "Mortar Mixing", pct: 93 }] },
    { name: "Jose Reyes", age: 38, city: "Marikina", rating: 4.7, years: 12, projects: 16, availability: "On Project", certifications: ["TESDA NC II — Masonry"], skills: [{ name: "Block Laying", pct: 92 }, { name: "Tile Setting", pct: 75 }, { name: "Plastering", pct: 85 }] },
    { name: "Benjamin Lim", age: 29, city: "Caloocan", rating: 4.5, years: 5, projects: 6, availability: "Available", certifications: ["TESDA NC II — Masonry"], skills: [{ name: "Block Laying", pct: 80 }, { name: "Plastering", pct: 60 }] },
  ],
  Carpenter: [
    { name: "Fernando Diaz", age: 41, city: "Makati", rating: 4.9, years: 15, projects: 28, availability: "Available", certifications: ["TESDA NC II — Carpentry"], skills: [{ name: "Form Work", pct: 96 }, { name: "Framing", pct: 92 }, { name: "Finishing", pct: 88 }] },
    { name: "Andres Garcia", age: 33, city: "Taguig", rating: 4.6, years: 9, projects: 14, availability: "Available in 1 wk", certifications: ["TESDA NC II — Carpentry"], skills: [{ name: "Form Work", pct: 85 }, { name: "Framing", pct: 90 }] },
  ],
  Electrician: [
    { name: "Ricardo Tan", age: 37, city: "Pasay", rating: 4.9, years: 13, projects: 22, availability: "Available", certifications: ["PRC Licensed Master Electrician", "TESDA NC II"], skills: [{ name: "Rough-in Wiring", pct: 95 }, { name: "Panel Board", pct: 92 }, { name: "Load Computation", pct: 88 }] },
    { name: "Victor Mendez", age: 30, city: "Quezon City", rating: 4.7, years: 7, projects: 11, availability: "Available", certifications: ["TESDA NC II — Electrical"], skills: [{ name: "Rough-in Wiring", pct: 85 }, { name: "Fixtures", pct: 90 }] },
  ],
  Plumber: [
    { name: "Carlos Bautista", age: 43, city: "Manila", rating: 4.8, years: 16, projects: 27, availability: "Available", certifications: ["PRC Licensed Master Plumber"], skills: [{ name: "Rough-in Piping", pct: 95 }, { name: "Drainage Layout", pct: 90 }, { name: "Fixture Installation", pct: 93 }] },
  ],
  Laborer: [
    { name: "Danilo Torres", age: 28, city: "Caloocan", rating: 4.3, years: 3, projects: 8, availability: "Available", certifications: [], skills: [{ name: "General Labor", pct: 75 }, { name: "Material Handling", pct: 80 }] },
    { name: "Miguel Ramos", age: 25, city: "Malabon", rating: 4.1, years: 2, projects: 4, availability: "Available", certifications: [], skills: [{ name: "General Labor", pct: 65 }] },
  ],
  Painter: [
    { name: "Alfredo Navarro", age: 36, city: "Pasig", rating: 4.7, years: 10, projects: 18, availability: "Available in 1 wk", certifications: ["TESDA NC II — Painting"], skills: [{ name: "Interior Painting", pct: 92 }, { name: "Exterior Coating", pct: 88 }, { name: "Texture Finish", pct: 80 }] },
  ],
  Welder: [
    { name: "Eduardo Castro", age: 39, city: "Valenzuela", rating: 4.8, years: 14, projects: 20, availability: "Available", certifications: ["AWS Certified Welder", "TESDA NC II — Welding"], skills: [{ name: "Arc Welding", pct: 95 }, { name: "Structural Welding", pct: 90 }, { name: "Metal Fabrication", pct: 85 }] },
  ],
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      <span style={{ color: "#f59e0b" }}>{"★".repeat(Math.floor(rating))}</span>
      <span className="text-xs font-600 mono" style={{ color: "#f59e0b" }}>{rating}</span>
    </div>
  );
}

function ProfileSheet({ workerType, color, onClose }: { workerType: string; color: string; onClose: () => void }) {
  const profiles = laborProfiles[workerType] || [];
  const [selected, setSelected] = useState<number | null>(null);

  const profile = selected !== null ? profiles[selected] : null;

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "#00000080" }} onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl"
        style={{ background: "#1a1d27", border: "1px solid #2a2f42", maxHeight: "92vh", overflowY: "auto", maxWidth: 480, margin: "0 auto" }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: "#374151" }} />
        </div>

        <div className="px-4 pb-8">
          {/* Header */}
          <div className="flex items-center justify-between py-3 mb-4">
            <div className="flex items-center gap-2">
              {profile && (
                <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#252a3a", color: "#9ca3af" }}>←</button>
              )}
              <div>
                <h2 className="text-lg font-700" style={{ color: "#f0f2f5" }}>
                  {profile ? profile.name : `${workerType} Profiles`}
                </h2>
                <p className="text-xs" style={{ color: "#6b7280" }}>
                  {profile ? `${workerType} · ${profile.city}` : `${profiles.length} available workers`}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-lg" style={{ background: "#252a3a", color: "#9ca3af" }}>✕</button>
          </div>

          {/* Profile list */}
          {!profile && (
            <div className="space-y-3">
              {profiles.length === 0 ? (
                <div className="text-center py-10" style={{ color: "#6b7280" }}>
                  <div className="text-3xl mb-2">👷</div>
                  <p className="text-sm">No profiles available for this trade</p>
                </div>
              ) : profiles.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setSelected(i)}
                  className="w-full text-left rounded-2xl p-4 transition-all active:scale-[0.98]"
                  style={{ background: "#252a3a", border: "1px solid #2a2f42" }}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-800 flex-shrink-0" style={{ background: color + "20", color }}>
                      {p.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="font-700 text-sm" style={{ color: "#f0f2f5" }}>{p.name}</span>
                        <span className="text-xs font-600 px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: p.availability === "Available" ? "#10b98120" : "#f59e0b20", color: p.availability === "Available" ? "#10b981" : "#f59e0b" }}>
                          {p.availability}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <StarRating rating={p.rating} />
                        <span className="text-xs" style={{ color: "#6b7280" }}>· {p.projects} projects · {p.years} yrs exp</span>
                      </div>
                      <span className="text-xs" style={{ color: "#6b7280" }}>📍 {p.city}</span>
                    </div>
                    <span className="text-sm" style={{ color: "#374151" }}>›</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Full profile view */}
          {profile && (
            <div className="space-y-4">
              {/* Identity card */}
              <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: color + "15", border: `1px solid ${color}30` }}>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-800 flex-shrink-0" style={{ background: color + "30", color }}>
                  {profile.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <h3 className="font-700 text-lg mb-0.5" style={{ color: "#f0f2f5" }}>{profile.name}</h3>
                  <StarRating rating={profile.rating} />
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full font-600" style={{ background: profile.availability === "Available" ? "#10b98120" : "#f59e0b20", color: profile.availability === "Available" ? "#10b981" : "#f59e0b" }}>
                      {profile.availability}
                    </span>
                    <span className="text-xs" style={{ color: "#9ca3af" }}>📍 {profile.city}</span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Years Exp.", value: `${profile.years} yrs`, c: color },
                  { label: "Projects", value: profile.projects, c: "#10b981" },
                  { label: "Age", value: profile.age, c: "#9ca3af" },
                ].map(({ label, value, c }) => (
                  <div key={label} className="p-3 rounded-xl text-center" style={{ background: "#252a3a" }}>
                    <div className="text-xs mb-0.5" style={{ color: "#6b7280" }}>{label}</div>
                    <div className="font-700 text-sm mono" style={{ color: c }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Skills */}
              <div className="rounded-2xl p-4" style={{ background: "#252a3a" }}>
                <h4 className="font-600 text-sm mb-3" style={{ color: "#f0f2f5" }}>Skills</h4>
                <div className="space-y-3">
                  {profile.skills.map(({ name, pct }) => (
                    <div key={name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: "#9ca3af" }}>{name}</span>
                        <span className="mono font-600" style={{ color }}>{pct}%</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: "#1a1d27" }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Certifications */}
              {profile.certifications.length > 0 && (
                <div className="rounded-2xl p-4" style={{ background: "#252a3a" }}>
                  <h4 className="font-600 text-sm mb-3" style={{ color: "#f0f2f5" }}>Certifications</h4>
                  <div className="space-y-2">
                    {profile.certifications.map(cert => (
                      <div key={cert} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "#1a1d27" }}>
                        <span style={{ color: "#10b981" }}>✓</span>
                        <span className="text-xs font-500" style={{ color: "#f0f2f5" }}>{cert}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="flex gap-2 pt-1">
                <button className="flex-1 py-3.5 rounded-2xl font-700 text-sm active:scale-[0.98]" style={{ background: color, color: "#0f1117" }}>
                  Request This Worker
                </button>
                <button className="px-4 py-3.5 rounded-2xl font-500 text-sm" style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42" }}>
                  Message
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function LaborEstimator() {
  const [data, setData] = useState<Worker[]>(initialWorkers);
  const [profileFor, setProfileFor] = useState<{ type: string; color: string } | null>(null);
  const total = data.reduce((s, w) => s + w.qty * w.days * w.dailyRate, 0);

  const toggleApprove = (i: number) => {
    setData(prev => prev.map((w, idx) => idx === i ? { ...w, approved: !w.approved } : w));
  };

  return (
    <>
      <div className="scroll-area">
        <div className="px-4 pt-4 pb-24 max-w-full">
          <div className="mb-5">
            <span className="text-xs font-600 px-2 py-0.5 rounded-full" style={{ background: "#f59e0b20", color: "#f59e0b" }}>🤖 AI GENERATED</span>
            <h1 className="text-2xl font-700 mt-2 mb-1" style={{ color: "#f0f2f5" }}>AI Labor Estimator</h1>
            <p className="text-sm" style={{ color: "#6b7280" }}>Workforce recommendation · My House Construction</p>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="p-4 rounded-xl text-center" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
              <div className="text-xs mb-1" style={{ color: "#6b7280" }}>Total Workers</div>
              <div className="text-2xl font-700" style={{ color: "#f0f2f5" }}>{data.reduce((s, w) => s + w.qty, 0)}</div>
            </div>
            <div className="p-4 rounded-xl text-center" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
              <div className="text-xs mb-1" style={{ color: "#6b7280" }}>Worker Types</div>
              <div className="text-2xl font-700" style={{ color: "#f0f2f5" }}>{data.length}</div>
            </div>
            <div className="p-4 rounded-xl text-center" style={{ background: "#1a1d27", border: "1px solid #f59e0b30" }}>
              <div className="text-xs mb-1" style={{ color: "#6b7280" }}>Total Labor Cost</div>
              <div className="text-base font-700 mono" style={{ color: "#f59e0b" }}>₱{(total / 1000000).toFixed(2)}M</div>
            </div>
          </div>

          <div className="space-y-2 mb-5">
            {data.map((w, i) => {
              const rowTotal = w.qty * w.days * w.dailyRate;
              const profileCount = (laborProfiles[w.type] || []).length;
              return (
                <div key={i} className="rounded-xl px-4 py-3" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: w.color }} />
                      <span className="font-600 text-sm" style={{ color: "#f0f2f5" }}>{w.type}</span>
                    </div>
                    <span className="font-700 mono text-sm" style={{ color: "#f59e0b" }}>₱{rowTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs mb-3" style={{ color: "#6b7280" }}>
                    <span>{w.qty} worker{w.qty > 1 ? "s" : ""} × {w.days} days</span>
                    <span>₱{w.dailyRate.toLocaleString()}/day</span>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => toggleApprove(i)}
                      className="px-3 py-1.5 rounded-lg text-xs font-500 transition-all"
                      style={{ background: w.approved ? "#10b98120" : "#252a3a", color: w.approved ? "#10b981" : "#9ca3af", border: `1px solid ${w.approved ? "#10b98140" : "#2a2f42"}` }}
                    >
                      {w.approved ? "✓ Approved" : "Approve"}
                    </button>
                    <button className="px-3 py-1.5 rounded-lg text-xs" style={{ background: "#252a3a", color: "#9ca3af" }}>Edit</button>
                    {profileCount > 0 && (
                      <button
                        onClick={() => setProfileFor({ type: w.type, color: w.color })}
                        className="flex-1 py-1.5 rounded-lg text-xs font-600 transition-all active:scale-[0.97]"
                        style={{ background: w.color + "15", color: w.color, border: `1px solid ${w.color}30` }}
                      >
                        👷 View {profileCount} Profile{profileCount > 1 ? "s" : ""}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl px-4 py-3 mb-5 flex justify-between items-center" style={{ background: "#f59e0b15", border: "1px solid #f59e0b30" }}>
            <span className="text-sm font-600" style={{ color: "#f0f2f5" }}>Estimated Total Labor Cost</span>
            <span className="text-lg font-800 mono" style={{ color: "#f59e0b" }}>₱{total.toLocaleString()}</span>
          </div>

          <div className="flex gap-3">
            <button className="flex-1 py-3.5 rounded-xl font-700 text-sm active:scale-[0.98]" style={{ background: "#f59e0b", color: "#0f1117" }}>Approve Labor Plan</button>
            <button className="px-5 py-3.5 rounded-xl font-500 text-sm" style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42" }}>Modify</button>
          </div>
        </div>
      </div>

      {profileFor && (
        <ProfileSheet
          workerType={profileFor.type}
          color={profileFor.color}
          onClose={() => setProfileFor(null)}
        />
      )}
    </>
  );
}
