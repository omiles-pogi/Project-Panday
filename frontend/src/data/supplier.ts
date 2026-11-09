// Inventory types and display constants. Inventory is real and persisted through /api/supplier-products;
// fulfillments come from /api/supplier-fulfillments.

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
