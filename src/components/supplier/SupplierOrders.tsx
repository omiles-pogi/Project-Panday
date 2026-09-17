import { useState } from "react";

type OrderStatus = "processing" | "ready" | "in-transit" | "delivered" | "cancelled";

type Order = {
  id: string;
  project: string;
  homeowner: string;
  location: string;
  material: string;
  qty: string;
  unit: string;
  amount: number;
  orderDate: string;
  deliveryDate: string;
  status: OrderStatus;
  paymentStatus: "paid" | "partial" | "pending";
  amountPaid: number;
};

const initialOrders: Order[] = [
  { id: "ORD-001", project: "Garcia Renovation", homeowner: "Pedro Garcia", location: "Makati", material: "Deformed Steel Bars 10mm", qty: "2,000", unit: "kg", amount: 132000, orderDate: "Sep 2, 2026", deliveryDate: "Sep 4, 2026", status: "delivered", paymentStatus: "paid", amountPaid: 132000 },
  { id: "ORD-002", project: "Lim Two-Story House", homeowner: "Lucy Lim", location: "Marikina", material: "CHB 4\" Hollow Blocks", qty: "4,200", unit: "pcs", amount: 74200, orderDate: "Sep 3, 2026", deliveryDate: "Sep 7, 2026", status: "in-transit", paymentStatus: "partial", amountPaid: 37100 },
  { id: "ORD-003", project: "Dela Cruz Residence", homeowner: "Juan Dela Cruz", location: "Quezon City", material: "Portland Cement", qty: "800", unit: "bags", amount: 224000, orderDate: "Sep 5, 2026", deliveryDate: "Sep 9, 2026", status: "ready", paymentStatus: "partial", amountPaid: 112000 },
  { id: "ORD-004", project: "Santos Commercial Bldg", homeowner: "Maria Santos", location: "Pasig City", material: "Sand & Gravel (Washed)", qty: "100", unit: "cu.m", amount: 190000, orderDate: "Sep 6, 2026", deliveryDate: "Sep 11, 2026", status: "processing", paymentStatus: "pending", amountPaid: 0 },
];

const statusStyle: Record<OrderStatus, { color: string; bg: string; label: string; icon: string }> = {
  processing: { color: "#3b82f6", bg: "#3b82f620", label: "Processing", icon: "⏳" },
  ready: { color: "#8b5cf6", bg: "#8b5cf620", label: "Ready for Delivery", icon: "📦" },
  "in-transit": { color: "#f59e0b", bg: "#f59e0b20", label: "In Transit", icon: "🚛" },
  delivered: { color: "#10b981", bg: "#10b98120", label: "Delivered", icon: "✓" },
  cancelled: { color: "#ef4444", bg: "#ef444420", label: "Cancelled", icon: "✕" },
};

const payStyle: Record<string, { color: string; label: string }> = {
  paid: { color: "#10b981", label: "Paid" },
  partial: { color: "#f59e0b", label: "Partial" },
  pending: { color: "#ef4444", label: "Unpaid" },
};

function UpdateSheet({ order, onClose, onUpdate }: {
  order: Order;
  onClose: () => void;
  onUpdate: (id: string, status: OrderStatus, note: string) => void;
}) {
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [note, setNote] = useState("");

  const steps: OrderStatus[] = ["processing", "ready", "in-transit", "delivered"];
  const currentIdx = steps.indexOf(order.status);

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "#00000080" }} onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl" style={{ background: "#1a1d27", border: "1px solid #2a2f42", maxHeight: "88vh", overflowY: "auto", maxWidth: 480, margin: "0 auto" }}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full" style={{ background: "#374151" }} /></div>
        <div className="px-4 pb-8">
          <div className="flex items-center justify-between py-3 mb-4">
            <div>
              <h2 className="text-lg font-700" style={{ color: "#f0f2f5" }}>Update Order</h2>
              <p className="text-xs" style={{ color: "#6b7280" }}>{order.id} · {order.material}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#252a3a", color: "#9ca3af" }}>✕</button>
          </div>

          {/* Progress stepper */}
          <div className="flex items-center mb-6">
            {steps.map((s, i) => {
              const done = steps.indexOf(status) >= i;
              const sc = statusStyle[s];
              return (
                <div key={s} className="flex items-center flex-1">
                  <button
                    onClick={() => setStatus(s)}
                    className="flex flex-col items-center gap-1 flex-shrink-0"
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-700 transition-all"
                      style={{ background: done ? sc.color : "#252a3a", color: done ? "#fff" : "#374151", border: `2px solid ${done ? sc.color : "#2a2f42"}` }}>
                      {statusStyle[s].icon}
                    </div>
                    <span className="text-xs text-center leading-tight" style={{ color: done ? sc.color : "#374151", fontSize: 9, maxWidth: 48 }}>{sc.label}</span>
                  </button>
                  {i < steps.length - 1 && (
                    <div className="flex-1 h-0.5 mx-1" style={{ background: steps.indexOf(status) > i ? statusStyle[steps[i + 1]].color : "#252a3a" }} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-600 mb-1.5" style={{ color: "#9ca3af" }}>Update Note (optional)</label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={3}
                placeholder={
                  status === "ready" ? "e.g. Items loaded and ready for pickup" :
                  status === "in-transit" ? "e.g. Truck dispatched, ETA 2 hours" :
                  status === "delivered" ? "e.g. Delivered and received by client" :
                  "Notes on order status..."
                }
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                style={{ background: "#252a3a", border: "1px solid #2a2f42", color: "#f0f2f5", fontSize: 16 }}
                onFocus={e => (e.target.style.borderColor = "#f59e0b")}
                onBlur={e => (e.target.style.borderColor = "#2a2f42")}
              />
            </div>

            <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: "#252a3a" }}>
              <span className="text-sm" style={{ color: "#9ca3af" }}>New Status</span>
              <span className="px-3 py-1 rounded-full text-xs font-700" style={{ background: statusStyle[status].bg, color: statusStyle[status].color }}>
                {statusStyle[status].icon} {statusStyle[status].label}
              </span>
            </div>

            <button
              onClick={() => { onUpdate(order.id, status, note); onClose(); }}
              className="w-full py-4 rounded-2xl font-700 text-base active:scale-[0.98]"
              style={{ background: "#f59e0b", color: "#0f1117" }}
            >
              Save Update
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function SupplierOrders() {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [updateSheet, setUpdateSheet] = useState<Order | null>(null);

  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);
  const totalRevenue = orders.filter(o => o.status === "delivered").reduce((s, o) => s + o.amount, 0);
  const totalPaid = orders.reduce((s, o) => s + o.amountPaid, 0);
  const totalPending = orders.reduce((s, o) => s + (o.amount - o.amountPaid), 0);

  const handleUpdate = (id: string, status: OrderStatus, _note: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
  };

  const tabs: { key: "all" | OrderStatus; label: string }[] = [
    { key: "all", label: "All" },
    { key: "processing", label: "Processing" },
    { key: "ready", label: "Ready" },
    { key: "in-transit", label: "In Transit" },
    { key: "delivered", label: "Delivered" },
  ];

  return (
    <>
      <div className="scroll-area">
        <div className="px-4 pt-4 pb-24 max-w-full">
          <div className="mb-5">
            <h1 className="text-2xl font-700 mb-1" style={{ color: "#f0f2f5" }}>Orders</h1>
            <p className="text-sm" style={{ color: "#6b7280" }}>Steel & More Co. · Active and past orders</p>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Total Revenue", value: `₱${(totalRevenue / 1000).toFixed(0)}K`, color: "#10b981" },
              { label: "Amount Received", value: `₱${(totalPaid / 1000).toFixed(0)}K`, color: "#f59e0b" },
              { label: "Pending Collection", value: `₱${(totalPending / 1000).toFixed(0)}K`, color: "#ef4444" },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-4 rounded-xl text-center" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
                <div className="text-xs mb-1 leading-snug" style={{ color: "#6b7280" }}>{label}</div>
                <div className="text-lg font-700 mono" style={{ color }}>{value}</div>
              </div>
            ))}
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

          {/* Order cards */}
          <div className="space-y-3">
            {filtered.map(order => {
              const s = statusStyle[order.status];
              const p = payStyle[order.paymentStatus];
              const outstanding = order.amount - order.amountPaid;
              return (
                <div key={order.id} className="rounded-xl p-4" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-700 text-sm" style={{ color: "#f0f2f5" }}>{order.id}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-600" style={{ background: s.bg, color: s.color }}>{s.icon} {s.label}</span>
                      </div>
                      <div className="text-xs" style={{ color: "#9ca3af" }}>{order.project}</div>
                      <div className="text-xs" style={{ color: "#6b7280" }}>{order.material} · {order.qty} {order.unit}</div>
                      <div className="text-xs mt-0.5" style={{ color: "#6b7280" }}>📍 {order.location} · Delivery: {order.deliveryDate}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-800 mono text-base" style={{ color: "#f59e0b" }}>₱{order.amount.toLocaleString()}</div>
                      <span className="text-xs font-600" style={{ color: p.color }}>{p.label}</span>
                    </div>
                  </div>

                  {/* Payment bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: "#6b7280" }}>Received: <span className="mono font-600" style={{ color: "#10b981" }}>₱{order.amountPaid.toLocaleString()}</span></span>
                      {outstanding > 0 && <span style={{ color: "#6b7280" }}>Outstanding: <span className="mono font-600" style={{ color: "#ef4444" }}>₱{outstanding.toLocaleString()}</span></span>}
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#252a3a" }}>
                      <div className="h-full rounded-full" style={{ width: `${(order.amountPaid / order.amount) * 100}%`, background: "#10b981" }} />
                    </div>
                  </div>

                  {order.status !== "delivered" && order.status !== "cancelled" && (
                    <button
                      onClick={() => setUpdateSheet(order)}
                      className="w-full py-2.5 rounded-xl text-xs font-700 active:scale-[0.97]"
                      style={{ background: "#f59e0b20", color: "#f59e0b", border: "1px solid #f59e0b30" }}
                    >
                      Update Order Status
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {updateSheet && <UpdateSheet order={updateSheet} onClose={() => setUpdateSheet(null)} onUpdate={handleUpdate} />}
    </>
  );
}
