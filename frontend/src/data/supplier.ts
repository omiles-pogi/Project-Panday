// Static sample data mirrored from the web app's supplier screens (since removed). There is no
// supplier API yet — SupplierContext holds this in memory, like the contractor/worker samples.

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

export type OrderStatus = "processing" | "ready" | "in-transit" | "delivered" | "cancelled";

export interface Order {
  id: string;
  project: string;
  homeowner: string;
  location: string;
  material: string;
  qty: number;
  unit: string;
  amount: number;
  orderDate: string;
  deliveryDate: string;
  status: OrderStatus;
  amountPaid: number;
  note: string;
}

export const INITIAL_ORDERS: Order[] = [
  { id: "ORD-001", project: "Garcia Renovation", homeowner: "Pedro Garcia", location: "Makati", material: "Deformed Steel Bars 10mm", qty: 2000, unit: "kg", amount: 132000, orderDate: "Sep 2, 2026", deliveryDate: "Sep 4, 2026", status: "delivered", amountPaid: 132000, note: "" },
  { id: "ORD-002", project: "Lim Two-Story House", homeowner: "Lucy Lim", location: "Marikina", material: 'CHB 4" Hollow Blocks', qty: 4200, unit: "pcs", amount: 74200, orderDate: "Sep 3, 2026", deliveryDate: "Sep 7, 2026", status: "in-transit", amountPaid: 37100, note: "" },
  { id: "ORD-003", project: "Dela Cruz Residence", homeowner: "Juan Dela Cruz", location: "Quezon City", material: "Portland Cement", qty: 800, unit: "bags", amount: 224000, orderDate: "Sep 5, 2026", deliveryDate: "Sep 9, 2026", status: "ready", amountPaid: 112000, note: "" },
  { id: "ORD-004", project: "Santos Commercial Bldg", homeowner: "Maria Santos", location: "Pasig City", material: "Sand & Gravel (Washed)", qty: 100, unit: "cu.m", amount: 190000, orderDate: "Sep 6, 2026", deliveryDate: "Sep 11, 2026", status: "processing", amountPaid: 0, note: "" },
];

export const ORDER_FLOW: OrderStatus[] = ["processing", "ready", "in-transit", "delivered"];

export const ORDER_STATUS: Record<OrderStatus, { color: string; label: string; icon: "time-outline" | "cube-outline" | "car-outline" | "checkmark-circle-outline" | "close-circle-outline" }> = {
  processing: { color: "#3b82f6", label: "Processing", icon: "time-outline" },
  ready: { color: "#8b5cf6", label: "Ready", icon: "cube-outline" },
  "in-transit": { color: "#f59e0b", label: "In Transit", icon: "car-outline" },
  delivered: { color: "#10b981", label: "Delivered", icon: "checkmark-circle-outline" },
  cancelled: { color: "#ef4444", label: "Cancelled", icon: "close-circle-outline" },
};

export type Demand = "High" | "Medium" | "Low";

export interface Product {
  id: number;
  name: string;
  category: string;
  unit: string;
  price: number;
  stock: number;
  demand: Demand;
  trend: "up" | "flat" | "down";
  minOrder: number;
  available: boolean;
}

export const INITIAL_PRODUCTS: Product[] = [
  { id: 1, name: "Portland Cement (Type I)", category: "Cement", unit: "bag", price: 280, stock: 5000, demand: "High", trend: "up", minOrder: 50, available: true },
  { id: 2, name: "Deformed Steel Bars 10mm", category: "Steel", unit: "kg", price: 68, stock: 12000, demand: "High", trend: "flat", minOrder: 100, available: true },
  { id: 3, name: "Deformed Steel Bars 12mm", category: "Steel", unit: "kg", price: 72, stock: 8000, demand: "High", trend: "up", minOrder: 100, available: true },
  { id: 4, name: "Deformed Steel Bars 16mm", category: "Steel", unit: "kg", price: 76, stock: 4500, demand: "Medium", trend: "flat", minOrder: 100, available: true },
  { id: 5, name: "Sand (Washed)", category: "Aggregate", unit: "cu.m", price: 1200, stock: 300, demand: "Medium", trend: "up", minOrder: 5, available: true },
  { id: 6, name: 'Gravel 3/4"', category: "Aggregate", unit: "cu.m", price: 1400, stock: 250, demand: "Medium", trend: "flat", minOrder: 5, available: true },
  { id: 7, name: 'CHB 4" Hollow Blocks', category: "Masonry", unit: "pc", price: 18, stock: 20000, demand: "Medium", trend: "flat", minOrder: 200, available: true },
  { id: 8, name: 'CHB 6" Hollow Blocks', category: "Masonry", unit: "pc", price: 22, stock: 8000, demand: "Low", trend: "down", minOrder: 200, available: true },
  { id: 9, name: "Metal Roofing (Long Span)", category: "Roofing", unit: "sheet", price: 650, stock: 500, demand: "Medium", trend: "up", minOrder: 10, available: false },
];

export const CATEGORIES = ["Cement", "Steel", "Aggregate", "Masonry", "Roofing", "Other"];

export const CAT_COLORS: Record<string, string> = {
  Cement: "#f59e0b",
  Steel: "#3b82f6",
  Aggregate: "#10b981",
  Masonry: "#8b5cf6",
  Roofing: "#f43f5e",
  Other: "#6b7280",
};

export const DEMAND_COLORS: Record<Demand, string> = {
  High: "#10b981",
  Medium: "#f59e0b",
  Low: "#6b7280",
};

export const TREND_ICON: Record<Product["trend"], { icon: "trending-up" | "remove" | "trending-down"; color: string }> = {
  up: { icon: "trending-up", color: "#10b981" },
  flat: { icon: "remove", color: "#6b7280" },
  down: { icon: "trending-down", color: "#ef4444" },
};
