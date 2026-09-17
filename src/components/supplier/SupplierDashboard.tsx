export default function SupplierDashboard() {
  return (
    <div className="scroll-area">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-700 mb-1" style={{ color: "#f0f2f5" }}>Supplier Dashboard</h1>
          <p className="text-sm" style={{ color: "#6b7280" }}>Steel & More Co. · Supplier Portal</p>
        </div>
        <button className="px-4 py-2 rounded-lg text-sm font-600 hover:opacity-90" style={{ background: "#f59e0b", color: "#0f1117" }}>+ Add Product</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Active Bids", value: "12", color: "#f59e0b" },
          { label: "Open Orders", value: "7", color: "#3b82f6" },
          { label: "Fulfilled (Month)", value: "34", color: "#10b981" },
          { label: "Revenue (Month)", value: "₱2.4M", color: "#8b5cf6" },
        ].map(({ label, value, color }) => (
          <div key={label} className="p-4 rounded-xl" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
            <div className="text-xs mb-1" style={{ color: "#6b7280" }}>{label}</div>
            <div className="text-2xl font-700" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <h2 className="font-600 text-sm mb-4" style={{ color: "#f0f2f5" }}>Recent Bid Requests</h2>
          <div className="space-y-3">
            {[
              { project: "Dela Cruz Residence", material: "Portland Cement — 2400 bags", budget: "₱672,000", deadline: "Sep 10, 2026" },
              { project: "Santos Commercial", material: "Steel Bars 12mm — 4 tons", budget: "₱288,000", deadline: "Sep 12, 2026" },
              { project: "Reyes Residence", material: "Sand & Gravel — 200 cu.m", budget: "₱380,000", deadline: "Sep 15, 2026" },
            ].map((r, i) => (
              <div key={i} className="p-4 rounded-lg" style={{ background: "#252a3a" }}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-500 text-sm" style={{ color: "#f0f2f5" }}>{r.project}</div>
                    <div className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>{r.material}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-600 mono text-sm" style={{ color: "#f59e0b" }}>{r.budget}</div>
                    <div className="text-xs" style={{ color: "#6b7280" }}>Due {r.deadline}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1 rounded text-xs font-500" style={{ background: "#f59e0b20", color: "#f59e0b" }}>Submit Bid</button>
                  <button className="px-3 py-1 rounded text-xs font-500" style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42" }}>View Details</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <h2 className="font-600 text-sm mb-4" style={{ color: "#f0f2f5" }}>AI-Recommended Listings</h2>
          <div className="rounded-xl p-4 mb-4" style={{ background: "#3b82f615", border: "1px solid #3b82f630" }}>
            <p className="text-sm" style={{ color: "#93c5fd" }}>
              🤖 <strong>AI Insight:</strong> 3 new residential projects in your service area (Metro Manila) have been approved and need cement, steel, and aggregate suppliers. Consider updating your pricing for competitive bids.
            </p>
          </div>
          <div className="space-y-3">
            {[
              { material: "Portland Cement", price: "₱280/bag", demand: "High", trend: "↑" },
              { material: "Steel Bars 10mm", price: "₱68/kg", demand: "High", trend: "→" },
              { material: "Sand (Washed)", price: "₱1,200/cu.m", demand: "Medium", trend: "↑" },
              { material: "Gravel 3/4\"", price: "₱1,400/cu.m", demand: "Medium", trend: "→" },
            ].map(({ material, price, demand, trend }) => (
              <div key={material} className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background: "#252a3a" }}>
                <span className="text-sm" style={{ color: "#9ca3af" }}>{material}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-600 mono" style={{ color: "#f0f2f5" }}>{price}</span>
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: demand === "High" ? "#f59e0b20" : "#252a3a", color: demand === "High" ? "#f59e0b" : "#6b7280" }}>{demand}</span>
                  <span className="text-sm" style={{ color: trend === "↑" ? "#10b981" : "#6b7280" }}>{trend}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
