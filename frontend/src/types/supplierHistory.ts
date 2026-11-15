export interface SupplierHistoryProject {
  id: number;
  title: string;
  homeownerName: string;
  completedAt: string | null;
  associationType: "selected_estimate";
  selectedCategories: string[];
  unverifiedSourceCount: number;
  /** Saved estimate lines for this supplier's selected categories; repeats remain separate. */
  lineCount: number;
  totalAmount: number | null;
  knownSubtotal: number;
  missingPriceCount: number;
}

export interface EstimatedHistoryItem {
  id: string;
  category: string | null;
  selectedCategory: string;
  priceSource: "supplier_listing" | "saved_estimate";
  sourceSupplierId: number | null;
  supplierProductId: number | null;
  name: string;
  quantity: number | null;
  unit: string;
  unitPrice: number | null;
  lineTotal: number | null;
}

export interface SupplierHistoryDetails extends SupplierHistoryProject {
  projectType: string | null;
  location: string | null;
  items: EstimatedHistoryItem[];
}
