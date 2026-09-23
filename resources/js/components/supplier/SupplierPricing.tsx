import { useState } from "react";

type Product = {
  id: number;
  name: string;
  category: string;
  unit: string;
  price: number;
  stock: number;
  stockUnit: string;
  demand: "High" | "Medium" | "Low";
  trend: "up" | "flat" | "down";
  minOrder: number;
  available: boolean;
};

const initialProducts: Product[] = [
  { id: 1, name: "Portland Cement (Type I)", category: "Cement", unit: "bag", price: 280, stock: 5000, stockUnit: "bags", demand: "High", trend: "up", minOrder: 50, available: true },
  { id: 2, name: "Deformed Steel Bars 10mm", category: "Steel", unit: "kg", price: 68, stock: 12000, stockUnit: "kg", demand: "High", trend: "flat", minOrder: 100, available: true },
  { id: 3, name: "Deformed Steel Bars 12mm", category: "Steel", unit: "kg", price: 72, stock: 8000, stockUnit: "kg", demand: "High", trend: "up", minOrder: 100, available: true },
  { id: 4, name: "Deformed Steel Bars 16mm", category: "Steel", unit: "kg", price: 76, stock: 4500, stockUnit: "kg", demand: "Medium", trend: "flat", minOrder: 100, available: true },
  { id: 5, name: "Sand (Washed)", category: "Aggregate", unit: "cu.m", price: 1200, stock: 300, stockUnit: "cu.m", demand: "Medium", trend: "up", minOrder: 5, available: true },
  { id: 6, name: "Gravel 3/4\"", category: "Aggregate", unit: "cu.m", price: 1400, stock: 250, stockUnit: "cu.m", demand: "Medium", trend: "flat", minOrder: 5, available: true },
  { id: 7, name: "CHB 4\" Hollow Blocks", category: "Masonry", unit: "pc", price: 18, stock: 20000, stockUnit: "pcs", demand: "Medium", trend: "flat", minOrder: 200, available: true },
  { id: 8, name: "CHB 6\" Hollow Blocks", category: "Masonry", unit: "pc", price: 22, stock: 8000, stockUnit: "pcs", demand: "Low", trend: "down", minOrder: 200, available: true },
  { id: 9, name: "Metal Roofing (Long Span)", category: "Roofing", unit: "sheet", price: 650, stock: 500, stockUnit: "sheets", demand: "Medium", trend: "up", minOrder: 10, available: false },
];

const catColors: Record<string, string> = {
  Cement: "#f59e0b", Steel: "#3b82f6", Aggregate: "#10b981",
  Masonry: "#8b5cf6", Roofing: "#f43f5e",
};

const demandColor: Record<string, { color: string; bg: string }> = {
  High: { color: "#10b981", bg: "#10b98120" },
  Medium: { color: "#f59e0b", bg: "#f59e0b20" },
  Low: { color: "#6b7280", bg: "#25253a" },
};

// --- Edit Price Sheet ---
function EditSheet({ product, onClose, onSave }: {
  product: Product;
  onClose: () => void;
  onSave: (id: number, price: number, stock: number, available: boolean) => void;
}) {
  const [price, setPrice] = useState(String(product.price));
  const [stock, setStock] = useState(String(product.stock));
  const [available, setAvailable] = useState(product.available);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const catColor = catColors[product.category] || "#6b7280";
  const priceDiff = parseFloat(price) - product.price;
  const pricePct = product.price > 0 ? ((priceDiff / product.price) * 100).toFixed(1) : "0";

  const validate = () => {
    const e: Record<string, string> = {};
    if (!price || isNaN(Number(price)) || Number(price) <= 0) e.price = "Enter a valid price";
    if (!stock || isNaN(Number(stock)) || Number(stock) < 0) e.stock = "Enter valid stock";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "#00000080" }} onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl" style={{ background: "#1a1d27", border: "1px solid #2a2f42", maxHeight: "88vh", overflowY: "auto", maxWidth: 480, margin: "0 auto" }}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full" style={{ background: "#374151" }} /></div>
        <div className="px-4 pb-8">
          <div className="flex items-center justify-between py-3 mb-4">
            <div>
              <h2 className="text-lg font-700" style={{ color: "#f0f2f5" }}>Edit Product</h2>
              <p className="text-xs" style={{ color: "#6b7280" }}>{product.name}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#252a3a", color: "#9ca3af" }}>✕</button>
          </div>

          <div className="space-y-4">
            {/* Current vs new price */}
            <div className="rounded-xl p-4" style={{ background: "#252a3a" }}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs" style={{ color: "#6b7280" }}>Current Price</span>
                <span className="mono font-700 text-lg" style={{ color: "#9ca3af" }}>₱{product.price.toLocaleString()}/{product.unit}</span>
              </div>
              {parseFloat(price) !== product.price && !isNaN(parseFloat(price)) && (
                <div className="flex justify-between items-center">
                  <span className="text-xs" style={{ color: "#6b7280" }}>Change</span>
                  <span className="mono font-600 text-sm" style={{ color: priceDiff > 0 ? "#ef4444" : "#10b981" }}>
                    {priceDiff > 0 ? "+" : ""}{priceDiff > 0 ? "₱" + priceDiff.toLocaleString() : "-₱" + Math.abs(priceDiff).toLocaleString()} ({pricePct}%)
                  </span>
                </div>
              )}
            </div>

            {/* New price */}
            <div>
              <label className="block text-xs font-600 mb-1.5" style={{ color: "#9ca3af" }}>New Unit Price (₱ per {product.unit}) *</label>
              <input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl text-base outline-none"
                style={{ background: "#252a3a", border: `1px solid ${errors.price ? "#ef4444" : catColor + "60"}`, color: "#f0f2f5", fontSize: 16 }}
                onFocus={e => (e.target.style.borderColor = catColor)}
                onBlur={e => (e.target.style.borderColor = errors.price ? "#ef4444" : catColor + "60")}
              />
              {errors.price && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{errors.price}</p>}
            </div>

            {/* Stock */}
            <div>
              <label className="block text-xs font-600 mb-1.5" style={{ color: "#9ca3af" }}>Current Stock ({product.stockUnit}) *</label>
              <input
                type="number"
                value={stock}
                onChange={e => setStock(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl text-base outline-none"
                style={{ background: "#252a3a", border: `1px solid ${errors.stock ? "#ef4444" : "#2a2f42"}`, color: "#f0f2f5", fontSize: 16 }}
                onFocus={e => (e.target.style.borderColor = "#f59e0b")}
                onBlur={e => (e.target.style.borderColor = errors.stock ? "#ef4444" : "#2a2f42")}
              />
              {errors.stock && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{errors.stock}</p>}
            </div>

            {/* Availability toggle */}
            <button
              onClick={() => setAvailable(!available)}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all"
              style={{ background: available ? "#10b98115" : "#ef444415", border: `1px solid ${available ? "#10b98140" : "#ef444440"}` }}
            >
              <span className="text-sm font-600" style={{ color: "#f0f2f5" }}>Product Availability</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-700" style={{ color: available ? "#10b981" : "#ef4444" }}>
                  {available ? "✓ Available" : "✕ Unavailable"}
                </span>
                <div className="w-11 h-6 rounded-full transition-all relative" style={{ background: available ? "#10b981" : "#374151" }}>
                  <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all" style={{ left: available ? 24 : 4 }} />
                </div>
              </div>
            </button>

            {/* AI note */}
            <div className="rounded-xl px-4 py-3" style={{ background: "#3b82f615", border: "1px solid #3b82f630" }}>
              <p className="text-xs leading-relaxed" style={{ color: "#93c5fd" }}>
                🤖 <strong>AI Pricing Note:</strong> Current market average for {product.name} is ₱{(product.price * 1.02).toFixed(0)}/{product.unit}. Your price is competitive. Raising by 3–5% may still keep you within the winning range.
              </p>
            </div>

            <button
              onClick={() => {
                if (!validate()) return;
                onSave(product.id, parseFloat(price), parseInt(stock), available);
                onClose();
              }}
              className="w-full py-4 rounded-2xl font-700 text-base active:scale-[0.98]"
              style={{ background: "#f59e0b", color: "#0f1117" }}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function SupplierPricing() {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [filterCat, setFilterCat] = useState("All");
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const categories = ["All", ...Array.from(new Set(products.map(p => p.category)))];
  const filtered = filterCat === "All" ? products : products.filter(p => p.category === filterCat);

  const handleSave = (id: number, price: number, stock: number, available: boolean) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, price, stock, available } : p));
  };

  return (
    <>
      <div className="scroll-area">
        <div className="px-4 pt-4 pb-24 max-w-full">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-700 mb-1" style={{ color: "#f0f2f5" }}>Pricing & Catalog</h1>
              <p className="text-sm" style={{ color: "#6b7280" }}>Steel & More Co. · {products.length} products</p>
            </div>
            <button className="px-3 py-2 rounded-xl text-sm font-700" style={{ background: "#f59e0b", color: "#0f1117" }}>+ Add Product</button>
          </div>

          {/* AI insight */}
          <div className="rounded-xl p-4 mb-5" style={{ background: "#f59e0b15", border: "1px solid #f59e0b30" }}>
            <p className="text-xs leading-relaxed" style={{ color: "#fbbf24" }}>
              🤖 <strong>AI Market Insight:</strong> Cement demand is up 12% this month. Steel bar prices are stable. Consider reviewing your cement pricing to stay competitive in active bid requests.
            </p>
          </div>

          {/* Category filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4" style={{ scrollbarWidth: "none" }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className="px-3 py-1.5 rounded-full text-xs font-600 whitespace-nowrap flex-shrink-0"
                style={{
                  background: filterCat === cat ? (catColors[cat] || "#f59e0b") : "#1a1d27",
                  color: filterCat === cat ? "#fff" : "#9ca3af",
                  border: `1px solid ${filterCat === cat ? "transparent" : "#2a2f42"}`,
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Product cards */}
          <div className="space-y-3">
            {filtered.map(p => {
              const catColor = catColors[p.category] || "#6b7280";
              const dm = demandColor[p.demand];
              return (
                <div key={p.id} className="rounded-xl p-4" style={{ background: "#1a1d27", border: "1px solid #2a2f42", opacity: p.available ? 1 : 0.6 }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-700 text-sm" style={{ color: "#f0f2f5" }}>{p.name}</span>
                        {!p.available && (
                          <span className="px-1.5 py-0.5 rounded text-xs font-600" style={{ background: "#ef444420", color: "#ef4444" }}>Unavailable</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded text-xs font-500" style={{ background: catColor + "20", color: catColor }}>{p.category}</span>
                        <span className="px-1.5 py-0.5 rounded text-xs font-500" style={{ background: dm.bg, color: dm.color }}>{p.demand} Demand</span>
                        <span className="text-xs" style={{ color: p.trend === "up" ? "#10b981" : p.trend === "down" ? "#ef4444" : "#6b7280" }}>
                          {p.trend === "up" ? "↑ Rising" : p.trend === "down" ? "↓ Falling" : "→ Stable"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xl font-800 mono" style={{ color: "#f59e0b" }}>₱{p.price.toLocaleString()}</div>
                      <div className="text-xs" style={{ color: "#6b7280" }}>per {p.unit}</div>
                    </div>
                  </div>

                  <div className="flex justify-between text-xs mb-3" style={{ color: "#6b7280" }}>
                    <span>Stock: <span className="mono font-600" style={{ color: "#9ca3af" }}>{p.stock.toLocaleString()} {p.stockUnit}</span></span>
                    <span>Min. order: {p.minOrder.toLocaleString()} {p.unit}s</span>
                  </div>

                  <button
                    onClick={() => setEditProduct(p)}
                    className="w-full py-2.5 rounded-xl text-xs font-700 active:scale-[0.97]"
                    style={{ background: catColor + "20", color: catColor, border: `1px solid ${catColor}40` }}
                  >
                    Edit Price & Stock
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {editProduct && <EditSheet product={editProduct} onClose={() => setEditProduct(null)} onSave={handleSave} />}
    </>
  );
}
