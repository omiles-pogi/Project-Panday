import { useState } from "react";

type Status = "pending" | "approved" | "rejected" | "modified";

const initialItems = [
  { title: "Construction Plan", version: "v1.2", date: "Sep 1, 2026", status: "approved" as Status },
  { title: "Project Budget", version: "v1.0", date: "Sep 2, 2026", status: "approved" as Status },
  { title: "Material Estimates", version: "v1.3", date: "Sep 3, 2026", status: "pending" as Status },
  { title: "Labor Plan", version: "v1.1", date: "Sep 3, 2026", status: "pending" as Status },
  { title: "Equipment Plan", version: "v1.0", date: "Sep 4, 2026", status: "pending" as Status },
  { title: "Project Schedule", version: "v1.0", date: "Sep 4, 2026", status: "rejected" as Status },
  { title: "Building Layout", version: "v2.0", date: "Sep 5, 2026", status: "modified" as Status },
  { title: "Conceptual Design", version: "v1.1", date: "Sep 5, 2026", status: "pending" as Status },
];

const sc: Record<Status, { color: string; bg: string; label: string }> = {
  pending: { color: "#f59e0b", bg: "#f59e0b20", label: "Pending Approval" },
  approved: { color: "#10b981", bg: "#10b98120", label: "Approved" },
  rejected: { color: "#ef4444", bg: "#ef444420", label: "Rejected" },
  modified: { color: "#3b82f6", bg: "#3b82f620", label: "Modified" },
};

export default function ApprovalCenter() {
  const [items, setItems] = useState(initialItems);

  const setStatus = (i: number, s: Status) => {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, status: s, date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) } : item));
  };

  const counts = { total: items.length, pending: items.filter(i => i.status === "pending").length, approved: items.filter(i => i.status === "approved").length, rejected: items.filter(i => i.status === "rejected").length };

  return (
    <div className="scroll-area">
      <div className="px-4 pt-4 pb-24 max-w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-700 mb-1" style={{ color: "#f0f2f5" }}>Approval Center</h1>
          <p className="text-sm" style={{ color: "#6b7280" }}>Review and approve AI-generated recommendations before they become visible to contractors.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: "Total Items", value: counts.total, color: "#f0f2f5" },
            { label: "Pending", value: counts.pending, color: "#f59e0b" },
            { label: "Approved", value: counts.approved, color: "#10b981" },
            { label: "Rejected", value: counts.rejected, color: "#ef4444" },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-4 rounded-xl text-center" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
              <div className="text-xs mb-1" style={{ color: "#6b7280" }}>{label}</div>
              <div className="text-2xl font-700" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl p-4 mb-4" style={{ background: "#3b82f615", border: "1px solid #3b82f630" }}>
          <p className="text-sm" style={{ color: "#93c5fd" }}>
            <strong>ℹ Important:</strong> Only <strong>Approved</strong> items will be shared with contractors. Pending and Rejected items remain private. You must review all items before project bidding opens.
          </p>
        </div>

        <div className="space-y-3">
          {items.map((item, i) => {
            const s = sc[item.status];
            return (
              <div key={i} className="rounded-xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-600" style={{ color: "#f0f2f5" }}>{item.title}</h3>
                      <span className="text-xs mono" style={{ color: "#6b7280" }}>{item.version}</span>
                    </div>
                    <div className="text-xs" style={{ color: "#6b7280" }}>Last updated: {item.date}</div>
                    {item.status === "approved" && (
                      <div className="text-xs mt-1" style={{ color: "#10b98180" }}>✓ Visible to contractors · Approved {item.date}</div>
                    )}
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-600 flex-shrink-0" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => setStatus(i, "approved")} className="px-2 py-1.5 rounded-lg text-xs font-600" style={{ background: "#10b98120", color: "#10b981" }}>✓</button>
                    <button onClick={() => setStatus(i, "modified")} className="px-2 py-1.5 rounded-lg text-xs font-600" style={{ background: "#3b82f620", color: "#3b82f6" }}>✏</button>
                    <button onClick={() => setStatus(i, "rejected")} className="px-2 py-1.5 rounded-lg text-xs font-600" style={{ background: "#ef444420", color: "#ef4444" }}>✕</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={() => setItems(prev => prev.map(i => ({ ...i, status: "approved" as Status })))} className="px-6 py-3 rounded-xl font-600 text-sm hover:opacity-90" style={{ background: "#10b981", color: "#fff" }}>Approve All</button>
          <p className="text-xs self-center" style={{ color: "#6b7280" }}>Approving all items will make them visible to contractors immediately.</p>
        </div>
      </div>
    </div>
  );
}
