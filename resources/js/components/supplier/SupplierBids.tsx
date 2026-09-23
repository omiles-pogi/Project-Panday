import { useState } from "react";

type BidStatus = "open" | "submitted" | "won" | "lost";

type BidRequest = {
  id: number;
  project: string;
  homeowner: string;
  location: string;
  material: string;
  qty: string;
  unit: string;
  budget: number;
  deadline: string;
  status: BidStatus;
  myBid: number | null;
  deliveryDate: string;
  notes: string;
};

const initialBids: BidRequest[] = [
  { id: 1, project: "Dela Cruz Residence", homeowner: "Juan Dela Cruz", location: "Quezon City", material: "Portland Cement", qty: "2,400", unit: "bags", budget: 672000, deadline: "Sep 10, 2026", status: "open", myBid: null, deliveryDate: "", notes: "" },
  { id: 2, project: "Santos Commercial Bldg", homeowner: "Maria Santos", location: "Pasig City", material: "Steel Bars 12mm", qty: "4,000", unit: "kg", budget: 288000, deadline: "Sep 12, 2026", status: "open", myBid: null, deliveryDate: "", notes: "" },
  { id: 3, project: "Reyes Residence", homeowner: "Ana Reyes", location: "Marikina", material: "Sand & Gravel (Washed)", qty: "200", unit: "cu.m", budget: 380000, deadline: "Sep 15, 2026", status: "open", myBid: null, deliveryDate: "", notes: "" },
  { id: 4, project: "Lim Two-Story House", homeowner: "Lucy Lim", location: "Marikina", material: "CHB 4\" Hollow Blocks", qty: "4,200", unit: "pcs", budget: 75600, deadline: "Sep 8, 2026", status: "submitted", myBid: 74200, deliveryDate: "Sep 7, 2026", notes: "Includes free delivery within Metro Manila" },
  { id: 5, project: "Garcia Renovation", homeowner: "Pedro Garcia", location: "Makati", material: "Deformed Steel Bars 10mm", qty: "2,000", unit: "kg", budget: 136000, deadline: "Sep 5, 2026", status: "won", myBid: 132000, deliveryDate: "Sep 4, 2026", notes: "" },
  { id: 6, project: "Aquino Commercial", homeowner: "Rosa Aquino", location: "Taguig", material: "Portland Cement", qty: "800", unit: "bags", budget: 224000, deadline: "Aug 30, 2026", status: "lost", myBid: 228000, deliveryDate: "", notes: "" },
];

const statusStyle: Record<BidStatus, { color: string; bg: string; label: string }> = {
  open: { color: "#3b82f6", bg: "#3b82f620", label: "Open" },
  submitted: { color: "#f59e0b", bg: "#f59e0b20", label: "Submitted" },
  won: { color: "#10b981", bg: "#10b98120", label: "Won ✓" },
  lost: { color: "#ef4444", bg: "#ef444420", label: "Lost" },
};

// --- Submit Bid Sheet ---
function BidSheet({ bid, onClose, onSubmit }: {
  bid: BidRequest;
  onClose: () => void;
  onSubmit: (id: number, price: number, delivery: string, notes: string) => void;
}) {
  const [unitPrice, setUnitPrice] = useState("");
  const [delivery, setDelivery] = useState("");
  const [notes, setNotes] = useState(bid.notes || "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const qty = parseFloat(bid.qty.replace(",", "")) || 1;
  const total = unitPrice ? Math.round(parseFloat(unitPrice) * qty) : 0;
  const budgetPct = total > 0 ? ((total / bid.budget) * 100).toFixed(1) : null;
  const isOver = total > bid.budget;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!unitPrice || isNaN(Number(unitPrice)) || Number(unitPrice) <= 0) e.unitPrice = "Enter a valid unit price";
    if (!delivery) e.delivery = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit(bid.id, total, delivery, notes);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "#00000080" }} onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl" style={{ background: "#1a1d27", border: "1px solid #2a2f42", maxHeight: "92vh", overflowY: "auto", maxWidth: 480, margin: "0 auto" }}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full" style={{ background: "#374151" }} /></div>
        <div className="px-4 pb-8">
          <div className="flex items-center justify-between py-3 mb-4">
            <div>
              <h2 className="text-lg font-700" style={{ color: "#f0f2f5" }}>Submit Bid</h2>
              <p className="text-xs" style={{ color: "#6b7280" }}>{bid.project} · {bid.material}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#252a3a", color: "#9ca3af" }}>✕</button>
          </div>

          {/* Bid request summary */}
          <div className="rounded-xl p-4 mb-5" style={{ background: "#252a3a" }}>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Material", value: bid.material },
                { label: "Quantity", value: `${bid.qty} ${bid.unit}` },
                { label: "Client Budget", value: `₱${bid.budget.toLocaleString()}` },
                { label: "Bid Deadline", value: bid.deadline },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-xs mb-0.5" style={{ color: "#6b7280" }}>{label}</div>
                  <div className="text-sm font-600" style={{ color: "#f0f2f5" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {/* Unit price */}
            <div>
              <label className="block text-xs font-600 mb-1.5" style={{ color: "#9ca3af" }}>Your Unit Price (₱ per {bid.unit}) *</label>
              <input
                type="number"
                value={unitPrice}
                onChange={e => setUnitPrice(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-3.5 rounded-xl text-base outline-none"
                style={{ background: "#252a3a", border: `1px solid ${errors.unitPrice ? "#ef4444" : "#2a2f42"}`, color: "#f0f2f5", fontSize: 16 }}
                onFocus={e => (e.target.style.borderColor = "#f59e0b")}
                onBlur={e => (e.target.style.borderColor = errors.unitPrice ? "#ef4444" : "#2a2f42")}
              />
              {errors.unitPrice && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{errors.unitPrice}</p>}
            </div>

            {/* Auto-computed total */}
            {total > 0 && (
              <div className="rounded-xl p-4" style={{ background: isOver ? "#ef444415" : "#10b98115", border: `1px solid ${isOver ? "#ef444440" : "#10b98140"}` }}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-600" style={{ color: "#f0f2f5" }}>Your Total Bid</span>
                  <span className="text-xl font-800 mono" style={{ color: isOver ? "#ef4444" : "#10b981" }}>₱{total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: "#6b7280" }}>₱{parseFloat(unitPrice).toLocaleString()} × {bid.qty} {bid.unit}</span>
                  <span style={{ color: isOver ? "#ef4444" : "#10b981" }}>
                    {budgetPct}% of budget {isOver ? "⚠ Over" : "✓ Under"}
                  </span>
                </div>
              </div>
            )}

            {/* Delivery date */}
            <div>
              <label className="block text-xs font-600 mb-1.5" style={{ color: "#9ca3af" }}>Committed Delivery Date *</label>
              <input
                type="date"
                value={delivery}
                onChange={e => setDelivery(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl text-base outline-none"
                style={{ background: "#252a3a", border: `1px solid ${errors.delivery ? "#ef4444" : "#2a2f42"}`, color: "#f0f2f5", fontSize: 16 }}
              />
              {errors.delivery && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{errors.delivery}</p>}
            </div>

            {/* Payment terms */}
            <div>
              <label className="block text-xs font-600 mb-1.5" style={{ color: "#9ca3af" }}>Payment Terms</label>
              <select className="w-full px-4 py-3.5 rounded-xl text-base outline-none" style={{ background: "#252a3a", border: "1px solid #2a2f42", color: "#f0f2f5", fontSize: 16 }}>
                <option>50% downpayment, 50% on delivery</option>
                <option>Full payment before delivery</option>
                <option>Full payment on delivery</option>
                <option>30 days credit terms</option>
                <option>COD (Cash on Delivery)</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-600 mb-1.5" style={{ color: "#9ca3af" }}>Bid Notes / Inclusions (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="e.g. Price includes delivery to site, VAT exclusive, subject to availability..."
                className="w-full px-4 py-3.5 rounded-xl text-sm outline-none resize-none"
                style={{ background: "#252a3a", border: "1px solid #2a2f42", color: "#f0f2f5", fontSize: 16 }}
                onFocus={e => (e.target.style.borderColor = "#f59e0b")}
                onBlur={e => (e.target.style.borderColor = "#2a2f42")}
              />
            </div>

            <button
              onClick={handleSubmit}
              className="w-full py-4 rounded-2xl font-700 text-base active:scale-[0.98]"
              style={{ background: "#f59e0b", color: "#0f1117" }}
            >
              Submit Bid — {total > 0 ? `₱${total.toLocaleString()}` : "Enter price above"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// --- Bid Detail Sheet ---
function DetailSheet({ bid, onClose, onBid }: { bid: BidRequest; onClose: () => void; onBid: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "#00000080" }} onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl" style={{ background: "#1a1d27", border: "1px solid #2a2f42", maxHeight: "88vh", overflowY: "auto", maxWidth: 480, margin: "0 auto" }}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full" style={{ background: "#374151" }} /></div>
        <div className="px-4 pb-8">
          <div className="flex items-center justify-between py-3 mb-4">
            <h2 className="text-lg font-700" style={{ color: "#f0f2f5" }}>Bid Request Details</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#252a3a", color: "#9ca3af" }}>✕</button>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl p-4" style={{ background: "#252a3a" }}>
              <div className="font-700 text-base mb-1" style={{ color: "#f0f2f5" }}>{bid.project}</div>
              <div className="text-sm mb-3" style={{ color: "#9ca3af" }}>{bid.homeowner} · 📍 {bid.location}</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Material Required", value: bid.material },
                  { label: "Quantity", value: `${bid.qty} ${bid.unit}` },
                  { label: "Client Budget", value: `₱${bid.budget.toLocaleString()}` },
                  { label: "Bid Deadline", value: bid.deadline },
                ].map(({ label, value }) => (
                  <div key={label} className="p-3 rounded-lg" style={{ background: "#1a1d27" }}>
                    <div className="text-xs mb-0.5" style={{ color: "#6b7280" }}>{label}</div>
                    <div className="text-sm font-600" style={{ color: "#f0f2f5" }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {bid.status === "submitted" && bid.myBid && (
              <div className="rounded-xl p-4" style={{ background: "#f59e0b15", border: "1px solid #f59e0b30" }}>
                <div className="text-xs font-600 mb-1" style={{ color: "#f59e0b" }}>YOUR SUBMITTED BID</div>
                <div className="text-2xl font-800 mono" style={{ color: "#f59e0b" }}>₱{bid.myBid.toLocaleString()}</div>
                {bid.notes && <p className="text-xs mt-2" style={{ color: "#fbbf24" }}>{bid.notes}</p>}
              </div>
            )}

            {bid.status === "won" && bid.myBid && (
              <div className="rounded-xl p-4" style={{ background: "#10b98115", border: "1px solid #10b98130" }}>
                <div className="text-xs font-600 mb-1" style={{ color: "#10b981" }}>✓ BID WON</div>
                <div className="text-2xl font-800 mono" style={{ color: "#10b981" }}>₱{bid.myBid.toLocaleString()}</div>
                <p className="text-xs mt-2" style={{ color: "#6ee7b7" }}>Delivery: {bid.deliveryDate}</p>
              </div>
            )}

            {bid.status === "lost" && bid.myBid && (
              <div className="rounded-xl p-4" style={{ background: "#ef444415", border: "1px solid #ef444430" }}>
                <div className="text-xs font-600 mb-1" style={{ color: "#ef4444" }}>BID NOT SELECTED</div>
                <div className="text-xl font-700 mono" style={{ color: "#ef4444" }}>₱{bid.myBid.toLocaleString()}</div>
                <p className="text-xs mt-2" style={{ color: "#fca5a5" }}>The homeowner selected a lower bid. Consider adjusting pricing for future bids.</p>
              </div>
            )}

            {bid.status === "open" && (
              <button
                onClick={() => { onClose(); onBid(); }}
                className="w-full py-4 rounded-2xl font-700 text-base active:scale-[0.98]"
                style={{ background: "#f59e0b", color: "#0f1117" }}
              >
                Submit Bid for This Request
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function SupplierBids() {
  const [bids, setBids] = useState<BidRequest[]>(initialBids);
  const [filter, setFilter] = useState<"all" | BidStatus>("all");
  const [bidSheet, setBidSheet] = useState<BidRequest | null>(null);
  const [detailSheet, setDetailSheet] = useState<BidRequest | null>(null);

  const filtered = filter === "all" ? bids : bids.filter(b => b.status === filter);

  const handleSubmitBid = (id: number, price: number, delivery: string, notes: string) => {
    setBids(prev => prev.map(b => b.id === id ? { ...b, status: "submitted", myBid: price, deliveryDate: delivery, notes } : b));
  };

  const tabs: { key: "all" | BidStatus; label: string }[] = [
    { key: "all", label: "All" },
    { key: "open", label: "Open" },
    { key: "submitted", label: "Submitted" },
    { key: "won", label: "Won" },
    { key: "lost", label: "Lost" },
  ];

  return (
    <>
      <div className="scroll-area">
        <div className="px-4 pt-4 pb-24 max-w-full">
          <div className="mb-5">
            <h1 className="text-2xl font-700 mb-1" style={{ color: "#f0f2f5" }}>Bids</h1>
            <p className="text-sm" style={{ color: "#6b7280" }}>Steel & More Co. · Bid requests & submissions</p>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { label: "Open Bids", value: bids.filter(b => b.status === "open").length, color: "#3b82f6" },
              { label: "Submitted", value: bids.filter(b => b.status === "submitted").length, color: "#f59e0b" },
              { label: "Won", value: bids.filter(b => b.status === "won").length, color: "#10b981" },
              { label: "Win Rate", value: `${Math.round((bids.filter(b => b.status === "won").length / bids.filter(b => b.status !== "open").length) * 100) || 0}%`, color: "#8b5cf6" },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-4 rounded-xl" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
                <div className="text-xs mb-1" style={{ color: "#6b7280" }}>{label}</div>
                <div className="text-xl font-700 mono" style={{ color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* AI Insight */}
          <div className="rounded-xl p-4 mb-5" style={{ background: "#3b82f615", border: "1px solid #3b82f630" }}>
            <p className="text-sm leading-relaxed" style={{ color: "#93c5fd" }}>
              🤖 <strong>AI Insight:</strong> 3 new projects in Metro Manila need cement & steel suppliers. Your current pricing is competitive — bidding within 90–95% of the client budget increases win rate by 34%.
            </p>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4" style={{ scrollbarWidth: "none" }}>
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className="px-3 py-1.5 rounded-full text-xs font-600 whitespace-nowrap flex-shrink-0"
                style={{ background: filter === key ? "#f59e0b" : "#1a1d27", color: filter === key ? "#0f1117" : "#9ca3af", border: `1px solid ${filter === key ? "transparent" : "#2a2f42"}` }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Bid cards */}
          <div className="space-y-3">
            {filtered.map(bid => {
              const s = statusStyle[bid.status];
              return (
                <div key={bid.id} className="rounded-xl p-4" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-700 text-sm mb-0.5 truncate" style={{ color: "#f0f2f5" }}>{bid.project}</div>
                      <div className="text-xs" style={{ color: "#9ca3af" }}>{bid.material} · {bid.qty} {bid.unit}</div>
                      <div className="text-xs mt-0.5" style={{ color: "#6b7280" }}>📍 {bid.location} · Due {bid.deadline}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="px-2 py-0.5 rounded-full text-xs font-600" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                      <div className="text-sm font-700 mono mt-1" style={{ color: "#f59e0b" }}>₱{bid.budget.toLocaleString()}</div>
                      <div className="text-xs" style={{ color: "#6b7280" }}>Budget</div>
                    </div>
                  </div>

                  {bid.myBid && (
                    <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg" style={{ background: bid.status === "won" ? "#10b98115" : bid.status === "lost" ? "#ef444415" : "#f59e0b15" }}>
                      <span className="text-xs" style={{ color: "#9ca3af" }}>My Bid:</span>
                      <span className="mono font-700 text-sm" style={{ color: bid.status === "won" ? "#10b981" : bid.status === "lost" ? "#ef4444" : "#f59e0b" }}>₱{bid.myBid.toLocaleString()}</span>
                      <span className="text-xs" style={{ color: "#6b7280" }}>({((bid.myBid / bid.budget) * 100).toFixed(0)}% of budget)</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {bid.status === "open" && (
                      <button
                        onClick={() => setBidSheet(bid)}
                        className="flex-1 py-2 rounded-xl text-xs font-700 active:scale-[0.97]"
                        style={{ background: "#f59e0b", color: "#0f1117" }}
                      >
                        Submit Bid
                      </button>
                    )}
                    <button
                      onClick={() => setDetailSheet(bid)}
                      className="flex-1 py-2 rounded-xl text-xs font-500"
                      style={{ background: "#252a3a", color: "#9ca3af", border: "1px solid #2a2f42" }}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {bidSheet && <BidSheet bid={bidSheet} onClose={() => setBidSheet(null)} onSubmit={handleSubmitBid} />}
      {detailSheet && (
        <DetailSheet
          bid={detailSheet}
          onClose={() => setDetailSheet(null)}
          onBid={() => setBidSheet(detailSheet)}
        />
      )}
    </>
  );
}
