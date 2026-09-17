const projects = [
  {
    name: "Reyes Family Residence",
    location: "Antipolo, Rizal",
    type: "Residential House",
    description: "3-bedroom modern house, 110 sqm, 2 floors. Requires earthquake-resistant design.",
    budget: "₱2,100,000",
    start: "Oct 1, 2026",
    target: "May 31, 2027",
    duration: "8 months",
    workers: "1 Foreman, 3 Carpenters, 3 Masons, 8 Laborers",
    equipment: "Concrete mixer, Scaffolding",
    ai: true,
  },
  {
    name: "Mercado Restaurant Build-out",
    location: "Pasig City",
    type: "Restaurant",
    description: "Full restaurant build-out on ground floor of a commercial space. 80 sqm, complete MEP works.",
    budget: "₱1,400,000",
    start: "Sep 20, 2026",
    target: "Jan 31, 2027",
    duration: "4.5 months",
    workers: "1 Foreman, 2 Carpenters, 2 Masons, 1 Electrician, 1 Plumber, 6 Laborers",
    equipment: "Light scaffolding, hand tools",
    ai: false,
  },
  {
    name: "Cruz Apartment Complex",
    location: "Cavite City",
    type: "Apartment",
    description: "4-unit apartment building, 3 stories. Separate meters, common areas.",
    budget: "₱5,800,000",
    start: "Nov 1, 2026",
    target: "Dec 31, 2027",
    duration: "14 months",
    workers: "2 Foremans, 6 Carpenters, 5 Masons, 2 Electricians, 2 Plumbers, 15 Laborers",
    equipment: "Concrete mixer, Scaffolding x3, Backhoe",
    ai: true,
  },
];

interface AvailableProjectsProps {
  onNav: (s: string) => void;
}

export default function AvailableProjects({ onNav }: AvailableProjectsProps) {
  return (
    <div className="scroll-area">
      <div className="px-4 pt-4 pb-24 max-w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-700 mb-1" style={{ color: "#f0f2f5" }}>Available Projects</h1>
            <p className="text-sm" style={{ color: "#6b7280" }}>Homeowner-approved projects open for contractor bids</p>
          </div>
          <div className="flex gap-2">
            <select className="px-3 py-2 rounded-lg text-sm" style={{ background: "#1a1d27", border: "1px solid #2a2f42", color: "#9ca3af" }}>
              <option>All Types</option>
              <option>Residential</option>
              <option>Commercial</option>
            </select>
          </div>
        </div>

        <div className="space-y-5">
          {projects.map((p, i) => (
            <div key={i} className="rounded-xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-700 text-base" style={{ color: "#f0f2f5" }}>{p.name}</h2>
                    {p.ai && <span className="text-xs px-2 py-0.5 rounded-full font-600" style={{ background: "#f59e0b20", color: "#f59e0b" }}>🤖 AI-Approved Plan</span>}
                  </div>
                  <p className="text-xs mb-1" style={{ color: "#6b7280" }}>{p.location} · {p.type}</p>
                  <p className="text-sm" style={{ color: "#9ca3af" }}>{p.description}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xl font-700 mono mb-1" style={{ color: "#f59e0b" }}>{p.budget}</div>
                  <div className="text-xs" style={{ color: "#6b7280" }}>Approved Budget</div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {[
                  { label: "Start Date", value: p.start },
                  { label: "Target Completion", value: p.target },
                  { label: "Est. Duration", value: p.duration },
                  { label: "Workforce Required", value: p.workers.split(",").length + " worker types" },
                ].map(({ label, value }) => (
                  <div key={label} className="p-3 rounded-lg" style={{ background: "#252a3a" }}>
                    <div className="text-xs mb-1" style={{ color: "#6b7280" }}>{label}</div>
                    <div className="text-xs font-500" style={{ color: "#f0f2f5" }}>{value}</div>
                  </div>
                ))}
              </div>

              <div className="mb-4 p-3 rounded-lg" style={{ background: "#252a3a" }}>
                <div className="text-xs mb-1" style={{ color: "#6b7280" }}>Required Workforce</div>
                <div className="text-xs" style={{ color: "#9ca3af" }}>{p.workers}</div>
              </div>

              <div className="flex gap-3">
                <button className="px-4 py-2 rounded-lg text-sm font-500" style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42" }}>View Project</button>
                <button onClick={() => onNav("capacity-monitor")} className="px-4 py-2 rounded-lg text-sm font-600 hover:opacity-90 transition-all" style={{ background: "#f59e0b", color: "#0f1117" }}>Accept Project</button>
                <button className="px-4 py-2 rounded-lg text-sm font-500" style={{ background: "#ef444420", color: "#ef4444" }}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
