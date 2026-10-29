// Bids below are still static sample data mirrored from the web app's supplier screens
// (no backend for them yet) — SupplierContext holds them in memory. Inventory (Product, at the
// bottom) is real and persisted through /api/supplier-products; orders come from /api/supplier-orders.

export type BidStatus = "open" | "submitted" | "won" | "lost";

export interface BidRequest {
  id: number;
  project: string;
  homeowner: string;
  location: string;
  material: string;
  qty: number;
  unit: string;
  budget: number;
  deadline: string;
  status: BidStatus;
  myBid: number | null;
  deliveryDate: string;
  notes: string;
  paymentTerms: string;
}

export const INITIAL_BIDS: BidRequest[] = [
  { id: 1, project: "Dela Cruz Residence", homeowner: "Juan Dela Cruz", location: "Quezon City", material: "Portland Cement", qty: 2400, unit: "bags", budget: 672000, deadline: "Sep 10, 2026", status: "open", myBid: null, deliveryDate: "", notes: "", paymentTerms: "" },
  { id: 2, project: "Santos Commercial Bldg", homeowner: "Maria Santos", location: "Pasig City", material: "Steel Bars 12mm", qty: 4000, unit: "kg", budget: 288000, deadline: "Sep 12, 2026", status: "open", myBid: null, deliveryDate: "", notes: "", paymentTerms: "" },
  { id: 3, project: "Reyes Residence", homeowner: "Ana Reyes", location: "Marikina", material: "Sand & Gravel (Washed)", qty: 200, unit: "cu.m", budget: 380000, deadline: "Sep 15, 2026", status: "open", myBid: null, deliveryDate: "", notes: "", paymentTerms: "" },
  { id: 4, project: "Lim Two-Story House", homeowner: "Lucy Lim", location: "Marikina", material: 'CHB 4" Hollow Blocks', qty: 4200, unit: "pcs", budget: 75600, deadline: "Sep 8, 2026", status: "submitted", myBid: 74200, deliveryDate: "2026-09-07", notes: "Includes free delivery within Metro Manila", paymentTerms: "50% downpayment, 50% on delivery" },
  { id: 5, project: "Garcia Renovation", homeowner: "Pedro Garcia", location: "Makati", material: "Deformed Steel Bars 10mm", qty: 2000, unit: "kg", budget: 136000, deadline: "Sep 5, 2026", status: "won", myBid: 132000, deliveryDate: "2026-09-04", notes: "", paymentTerms: "Full payment on delivery" },
  { id: 6, project: "Aquino Commercial", homeowner: "Rosa Aquino", location: "Taguig", material: "Portland Cement", qty: 800, unit: "bags", budget: 224000, deadline: "Aug 30, 2026", status: "lost", myBid: 228000, deliveryDate: "", notes: "", paymentTerms: "" },
];

export const BID_STATUS: Record<BidStatus, { color: string; label: string }> = {
  open: { color: "#3b82f6", label: "Open" },
  submitted: { color: "#f59e0b", label: "Submitted" },
  won: { color: "#10b981", label: "Won" },
  lost: { color: "#ef4444", label: "Lost" },
};

export const PAYMENT_TERMS = [
  "50% downpayment, 50% on delivery",
  "Full payment before delivery",
  "Full payment on delivery",
];

// ---- Inventory (real, persisted via /api/supplier-products) ----

export type StockStatus = "in_stock" | "out_of_stock";

export interface Product {
  id: number;
  name: string;
  category: string;
  description: string;
  unit: string;
  price: number;
  /** Physical on-hand quantity. */
  stock: number;
  /** Held for supplier-confirmed orders until delivery. */
  reserved: number;
  /** stock − reserved (what can still be promised to new requests). */
  availableQuantity: number;
  minOrder: number;
  /** Shown in the homeowner/contractor catalog. Deactivated listings stay in the supplier's list. */
  isActive: boolean;
  /** Derived by the backend from `stock` — the single source of truth for In/Out of Stock. */
  stockStatus: StockStatus;
}

export type ProductInput = Omit<Product, "id" | "stockStatus" | "reserved" | "availableQuantity">;

/** Must match SupplierProduct::CATEGORIES on the backend (it validates against that list). */
export const CATEGORIES = [
  "Cement",
  "Sand",
  "Gravel",
  "Aggregate",
  "Steel",
  "Lumber",
  "Masonry",
  "Paint",
  "Electrical",
  "Plumbing",
  "Roofing",
  "Hardware",
  "Other",
];

export const UNITS = ["piece", "bag", "kg", "meter", "cu.m", "sheet", "liter", "gallon", "roll", "box", "set"];

export const CAT_COLORS: Record<string, string> = {
  Cement: "#f59e0b",
  Sand: "#d97706",
  Gravel: "#78716c",
  Aggregate: "#10b981",
  Steel: "#3b82f6",
  Lumber: "#a16207",
  Masonry: "#8b5cf6",
  Paint: "#ec4899",
  Electrical: "#eab308",
  Plumbing: "#06b6d4",
  Roofing: "#f43f5e",
  Hardware: "#64748b",
  Other: "#6b7280",
};
