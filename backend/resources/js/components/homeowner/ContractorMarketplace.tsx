import { useState } from "react";

const contractors = [
  {
    name: "RCG Construction Corp.",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&auto=format",
    experience: "15 years",
    specialization: "Residential & Commercial",
    rating: 4.8,
    completed: 127,
    active: 4,
    capacity: "Available",
    area: "Metro Manila, Bulacan",
    payment: "Progress Billing",
    workers: 45,
    equipment: "Full set",
    badge: "Top Rated",
  },
  {
    name: "Solidbuild Construction",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&auto=format",
    experience: "10 years",
    specialization: "Residential Houses",
    rating: 4.6,
    completed: 84,
    active: 2,
    capacity: "Limited",
    area: "Quezon City, Rizal",
    payment: "Milestone-based",
    workers: 28,
    equipment: "Moderate",
    badge: "Verified",
  },
  {
    name: "Atlas Builder Group",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&auto=format",
    experience: "8 years",
    specialization: "Two-Story & Renovation",
    rating: 4.4,
    completed: 56,
    active: 3,
    capacity: "Available",
    area: "Metro Manila",
    payment: "Progress Billing",
    workers: 22,
    equipment: "Basic",
    badge: "Rising",
  },
];

const capColors: Record<string, string> = { Available: "#10b981", Limited: "#f59e0b", Unavailable: "#ef4444" };
const capBg: Record<string, string> = { Available: "#10b98120", Limited: "#f59e0b20", Unavailable: "#ef444420" };

export default function ContractorMarketplace() {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="scroll-area">
      <div className="px-4 pt-4 pb-24 max-w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-700 mb-1" style={{ color: "#f0f2f5" }}>Contractor Marketplace</h1>
            <p className="text-sm" style={{ color: "#6b7280" }}>Find and compare verified contractors in your area. You make the final decision.</p>
          </div>
          <div className="flex gap-2">
            <input placeholder="Search contractors..." className="px-4 py-2 rounded-lg text-sm outline-none" style={{ background: "#1a1d27", border: "1px solid #2a2f42", color: "#f0f2f5", width: 220 }} />
            <select className="px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "#1a1d27", border: "1px solid #2a2f42", color: "#9ca3af" }}>
              <option>All Areas</option>
              <option>Metro Manila</option>
              <option>Quezon City</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl p-4 mb-5 flex items-center gap-3" style={{ background: "#3b82f615", border: "1px solid #3b82f630" }}>
          <span>🤖</span>
          <p className="text-sm" style={{ color: "#93c5fd" }}>
            <strong>AI Recommendation:</strong> Based on your project size (120 sqm, 2 floors) and location, <strong>RCG Construction Corp.</strong> and <strong>Solidbuild Construction</strong> are the best matches. Final selection remains your decision.
          </p>
        </div>

        <div className="space-y-4">
          {contractors.map((c, i) => (
            <div key={i} className="rounded-xl p-5 transition-all" style={{ background: "#1a1d27", border: selected === i ? "1px solid #f59e0b" : "1px solid #2a2f42" }}>
              <div className="flex items-start gap-4">
                <img src={c.image} alt={c.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" style={{ background: "#252a3a" }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-700" style={{ color: "#f0f2f5" }}>{c.name}</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-600" style={{ background: "#f59e0b20", color: "#f59e0b" }}>{c.badge}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-600" style={{ background: capBg[c.capacity], color: capColors[c.capacity] }}>{c.capacity}</span>
                  </div>
                  <p className="text-sm mb-3" style={{ color: "#9ca3af" }}>{c.specialization} · {c.experience} experience · {c.area}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Rating", value: `⭐ ${c.rating}` },
                      { label: "Completed", value: c.completed },
                      { label: "Active", value: c.active },
                      { label: "Workers", value: c.workers },
                      { label: "Equipment", value: c.equipment },
                      { label: "Payment", value: c.payment },
                    ].map(({ label, value }) => (
                      <div key={label} className="p-2 rounded-lg text-center" style={{ background: "#252a3a" }}>
                        <div className="text-xs mb-0.5" style={{ color: "#6b7280" }}>{label}</div>
                        <div className="text-xs font-600" style={{ color: "#f0f2f5" }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button className="px-4 py-2 rounded-lg text-sm font-500 whitespace-nowrap" style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42" }}>View Profile</button>
                  <button onClick={() => setSelected(selected === i ? null : i)} className="px-4 py-2 rounded-lg text-sm font-600 whitespace-nowrap hover:opacity-90 transition-all" style={{ background: selected === i ? "#f59e0b" : "#f59e0b20", color: selected === i ? "#0f1117" : "#f59e0b" }}>
                    {selected === i ? "✓ Selected" : "Select"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {selected !== null && (
          <div className="mt-6 p-5 rounded-xl" style={{ background: "#f59e0b15", border: "1px solid #f59e0b40" }}>
            <h3 className="font-600 mb-2" style={{ color: "#f59e0b" }}>You selected: {contractors[selected].name}</h3>
            <p className="text-sm mb-4" style={{ color: "#9ca3af" }}>Confirming will send them your approved project details and start the bidding process.</p>
            <button className="px-6 py-2.5 rounded-lg font-600 text-sm hover:opacity-90 transition-all" style={{ background: "#f59e0b", color: "#0f1117" }}>Confirm & Send Project Details</button>
          </div>
        )}
      </div>
    </div>
  );
}
