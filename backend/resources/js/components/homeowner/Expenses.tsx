import { useState } from "react";

type Expense = {
  date: string;
  category: string;
  description: string;
  amount: number;
  phase: string;
  status: string;
};

const initialExpenses: Expense[] = [
  { date: "Sep 5", category: "Materials", description: "Portland Cement — 200 bags", amount: 56000, phase: "Foundation", status: "verified" },
  { date: "Sep 4", category: "Labor", description: "Weekly wages — 21 workers", amount: 105000, phase: "Structural", status: "verified" },
  { date: "Sep 3", category: "Materials", description: "Steel Bars 12mm — 2 tons", amount: 144000, phase: "Structural", status: "verified" },
  { date: "Sep 2", category: "Equipment", description: "Concrete mixer rental", amount: 9000, phase: "Foundation", status: "pending" },
  { date: "Sep 1", category: "Transportation", description: "Gravel delivery — 3 trips", amount: 6000, phase: "Foundation", status: "verified" },
  { date: "Aug 30", category: "Permits", description: "Building permit renewal", amount: 15000, phase: "Admin", status: "verified" },
  { date: "Aug 28", category: "Materials", description: "Hollow blocks — 1000 pcs", amount: 18000, phase: "Walls", status: "pending" },
  { date: "Aug 25", category: "Other", description: "Safety equipment & PPE", amount: 8500, phase: "All", status: "verified" },
];

const categoryColors: Record<string, string> = {
  Materials: "#f59e0b", Labor: "#3b82f6", Equipment: "#8b5cf6",
  Transportation: "#10b981", Permits: "#f43f5e", Other: "#6b7280",
};

const CATEGORIES = ["Materials", "Labor", "Equipment", "Transportation", "Permits", "Other"];
const PHASES = ["Foundation", "Structural", "Walls & Masonry", "Roofing", "Electrical", "Plumbing", "Finishing", "Admin", "All"];

// --- Add Expense Sheet ---
function AddExpenseSheet({ onClose, onAdd }: { onClose: () => void; onAdd: (e: Expense) => void }) {
  const [form, setForm] = useState({
    date: "",
    category: "Materials",
    description: "",
    amount: "",
    phase: "Foundation",
    supplier: "",
    notes: "",
  });
  const [receipt, setReceipt] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.description.trim()) e.description = "Required";
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) e.amount = "Enter a valid amount";
    if (!form.date) e.date = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onAdd({
      date: form.date,
      category: form.category,
      description: form.description + (form.supplier ? ` — ${form.supplier}` : ""),
      amount: Number(form.amount),
      phase: form.phase,
      status: "pending",
    });
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "#00000080" }}
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl"
        style={{ background: "#1a1d27", border: "1px solid #2a2f42", maxHeight: "90vh", overflowY: "auto", maxWidth: 480, margin: "0 auto" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: "#374151" }} />
        </div>

        <div className="px-4 pb-8">
          {/* Header */}
          <div className="flex items-center justify-between py-3 mb-4">
            <h2 className="text-lg font-700" style={{ color: "#f0f2f5" }}>Add Expense</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
              style={{ background: "#252a3a", color: "#9ca3af" }}
            >✕</button>
          </div>

          <div className="space-y-4">
            {/* Date + Category */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-600 mb-1.5" style={{ color: "#9ca3af" }}>Date *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => set("date", e.target.value)}
                  className="w-full px-3 py-3 rounded-xl text-sm outline-none"
                  style={{ background: "#252a3a", border: `1px solid ${errors.date ? "#ef4444" : "#2a2f42"}`, color: "#f0f2f5", fontSize: 16 }}
                />
                {errors.date && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{errors.date}</p>}
              </div>
              <div>
                <label className="block text-xs font-600 mb-1.5" style={{ color: "#9ca3af" }}>Category</label>
                <select
                  value={form.category}
                  onChange={e => set("category", e.target.value)}
                  className="w-full px-3 py-3 rounded-xl text-sm outline-none"
                  style={{ background: "#252a3a", border: "1px solid #2a2f42", color: "#f0f2f5", fontSize: 16 }}
                >
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-600 mb-1.5" style={{ color: "#9ca3af" }}>Description *</label>
              <input
                value={form.description}
                onChange={e => set("description", e.target.value)}
                placeholder="e.g. Portland Cement — 200 bags"
                className="w-full px-3 py-3 rounded-xl text-sm outline-none"
                style={{ background: "#252a3a", border: `1px solid ${errors.description ? "#ef4444" : "#2a2f42"}`, color: "#f0f2f5", fontSize: 16 }}
                onFocus={e => (e.target.style.borderColor = "#f59e0b")}
                onBlur={e => (e.target.style.borderColor = errors.description ? "#ef4444" : "#2a2f42")}
              />
              {errors.description && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{errors.description}</p>}
            </div>

            {/* Amount + Phase */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-600 mb-1.5" style={{ color: "#9ca3af" }}>Amount (₱) *</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={e => set("amount", e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-3 rounded-xl text-sm outline-none"
                  style={{ background: "#252a3a", border: `1px solid ${errors.amount ? "#ef4444" : "#2a2f42"}`, color: "#f0f2f5", fontSize: 16 }}
                  onFocus={e => (e.target.style.borderColor = "#f59e0b")}
                  onBlur={e => (e.target.style.borderColor = errors.amount ? "#ef4444" : "#2a2f42")}
                />
                {errors.amount && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{errors.amount}</p>}
              </div>
              <div>
                <label className="block text-xs font-600 mb-1.5" style={{ color: "#9ca3af" }}>Project Phase</label>
                <select
                  value={form.phase}
                  onChange={e => set("phase", e.target.value)}
                  className="w-full px-3 py-3 rounded-xl text-sm outline-none"
                  style={{ background: "#252a3a", border: "1px solid #2a2f42", color: "#f0f2f5", fontSize: 16 }}
                >
                  {PHASES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>

            {/* Supplier / Payee */}
            <div>
              <label className="block text-xs font-600 mb-1.5" style={{ color: "#9ca3af" }}>Supplier / Payee (optional)</label>
              <input
                value={form.supplier}
                onChange={e => set("supplier", e.target.value)}
                placeholder="e.g. San Miguel Cement, Contractor"
                className="w-full px-3 py-3 rounded-xl text-sm outline-none"
                style={{ background: "#252a3a", border: "1px solid #2a2f42", color: "#f0f2f5", fontSize: 16 }}
                onFocus={e => (e.target.style.borderColor = "#f59e0b")}
                onBlur={e => (e.target.style.borderColor = "#2a2f42")}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-600 mb-1.5" style={{ color: "#9ca3af" }}>Notes (optional)</label>
              <textarea
                value={form.notes}
                onChange={e => set("notes", e.target.value)}
                rows={2}
                placeholder="Additional details, reference numbers, etc."
                className="w-full px-3 py-3 rounded-xl text-sm outline-none resize-none"
                style={{ background: "#252a3a", border: "1px solid #2a2f42", color: "#f0f2f5", fontSize: 16 }}
                onFocus={e => (e.target.style.borderColor = "#f59e0b")}
                onBlur={e => (e.target.style.borderColor = "#2a2f42")}
              />
            </div>

            {/* Receipt upload */}
            <button
              onClick={() => setReceipt(!receipt)}
              className="w-full py-3 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 transition-all"
              style={{ borderColor: receipt ? "#f59e0b" : "#2a2f42", background: receipt ? "#f59e0b10" : "transparent" }}
            >
              <span className="text-lg">{receipt ? "✓" : "📷"}</span>
              <span className="text-sm font-500" style={{ color: receipt ? "#f59e0b" : "#6b7280" }}>
                {receipt ? "Receipt attached" : "Attach receipt photo (optional)"}
              </span>
            </button>

            {/* Category preview */}
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: "#252a3a" }}>
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: categoryColors[form.category] || "#6b7280" }} />
              <span className="text-xs" style={{ color: "#9ca3af" }}>
                {form.category} · {form.phase}
                {form.amount ? <span className="mono font-600" style={{ color: "#f59e0b" }}> · ₱{Number(form.amount).toLocaleString()}</span> : ""}
              </span>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              className="w-full py-4 rounded-2xl font-700 text-base transition-all active:scale-[0.98]"
              style={{ background: "#f59e0b", color: "#0f1117" }}
            >
              Add Expense
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// --- Main Component ---
export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const categories = ["All", ...CATEGORIES];

  const filtered = expenses.filter(e =>
    (filter === "All" || e.category === filter) &&
    (search === "" || e.description.toLowerCase().includes(search.toLowerCase()))
  );
  const total = filtered.reduce((s, e) => s + e.amount, 0);

  const matTotal = expenses.filter(e => e.category === "Materials").reduce((s, e) => s + e.amount, 0);
  const labTotal = expenses.filter(e => e.category === "Labor").reduce((s, e) => s + e.amount, 0);
  const eqTotal = expenses.filter(e => e.category === "Equipment").reduce((s, e) => s + e.amount, 0);
  const otherTotal = expenses.filter(e => !["Materials", "Labor", "Equipment"].includes(e.category)).reduce((s, e) => s + e.amount, 0);

  const handleAdd = (e: Expense) => setExpenses(prev => [e, ...prev]);

  return (
    <>
      <div className="scroll-area">
        <div className="px-4 pt-4 pb-24 max-w-full">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-700 mb-1" style={{ color: "#f0f2f5" }}>Expenses</h1>
              <p className="text-sm" style={{ color: "#6b7280" }}>My House Construction</p>
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="px-3 py-2 rounded-xl text-sm font-700 active:scale-[0.97]"
              style={{ background: "#f59e0b", color: "#0f1117" }}
            >
              + Add
            </button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { label: "Total Expenses", value: expenses.reduce((s, e) => s + e.amount, 0), color: "#f59e0b" },
              { label: "Materials", value: matTotal, color: "#f59e0b" },
              { label: "Labor", value: labTotal, color: "#3b82f6" },
              { label: "Equipment + Other", value: eqTotal + otherTotal, color: "#6b7280" },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-4 rounded-xl" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
                <div className="text-xs mb-1" style={{ color: "#6b7280" }}>{label}</div>
                <div className="font-700 mono text-base" style={{ color }}>₱{value.toLocaleString()}</div>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="rounded-xl px-4 py-3 mb-3 flex items-center gap-2" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
            <span style={{ color: "#6b7280" }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search expenses…"
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "#f0f2f5" }}
            />
          </div>

          {/* Category chips */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4" style={{ scrollbarWidth: "none" }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className="px-3 py-1.5 rounded-full text-xs font-500 whitespace-nowrap flex-shrink-0 transition-all"
                style={{
                  background: filter === cat ? (categoryColors[cat] || "#f59e0b") : "#1a1d27",
                  color: filter === cat ? "#fff" : "#9ca3af",
                  border: `1px solid ${filter === cat ? "transparent" : "#2a2f42"}`,
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Expense cards */}
          <div className="space-y-2 mb-4">
            {filtered.length === 0 ? (
              <div className="text-center py-10" style={{ color: "#6b7280" }}>
                <div className="text-3xl mb-2">📋</div>
                <p className="text-sm">No expenses found</p>
              </div>
            ) : filtered.map((e, i) => (
              <div key={i} className="rounded-xl px-4 py-3" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-500 leading-snug" style={{ color: "#f0f2f5" }}>{e.description}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs" style={{ color: "#6b7280" }}>{e.date} · {e.phase}</span>
                      <span className="px-1.5 py-0.5 rounded text-xs font-500" style={{ background: `${categoryColors[e.category] || "#6b7280"}20`, color: categoryColors[e.category] || "#6b7280" }}>{e.category}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-700 mono text-sm" style={{ color: "#f59e0b" }}>₱{e.amount.toLocaleString()}</div>
                    <span className="text-xs font-500" style={{ color: e.status === "verified" ? "#10b981" : "#f59e0b" }}>
                      {e.status === "verified" ? "✓ Verified" : "Pending"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center px-1 py-2">
            <span className="text-xs" style={{ color: "#6b7280" }}>{filtered.length} records</span>
            <span className="font-700 mono text-sm" style={{ color: "#f59e0b" }}>Total: ₱{total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {showAdd && <AddExpenseSheet onClose={() => setShowAdd(false)} onAdd={handleAdd} />}
    </>
  );
}
