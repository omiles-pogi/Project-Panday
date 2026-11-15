import { apiFetch } from "@/services/api/client";

export type StockStatus = "in_stock" | "out_of_stock";

export interface SupplierProductDto {
  id: number;
  supplier_id: number;
  name: string;
  category: string;
  description: string | null;
  unit: string;
  price: number;
  /** Physical on-hand quantity. */
  stock: number;
  /** Units promised to supplier-confirmed orders that have not been delivered yet. */
  reserved: number;
  /** Available to promise = stock − reserved; what the stock badge is based on. */
  available_quantity: number;
  min_order: number;
  /** Listed in the homeowner/contractor catalog. Deactivated listings are kept but hidden. */
  is_active: boolean;
  /** Always derived server-side from available_quantity (> 0 → in stock) — never set it directly. */
  stock_status: StockStatus;
  activation_eligible?: boolean;
  activation_block_reason?: string | null;
  stock_confirmed?: boolean;
  stock_confirmed_at?: string | null;
  stock_confirmed_by?: number | null;
  stock_confirmed_quantity?: number | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierProductInput {
  name: string;
  category: string;
  description: string | null;
  unit: string;
  price: number;
  stock: number;
  min_order: number;
  is_active?: boolean;
}

/** A catalog listing as homeowners/contractors see it — includes the supplier's public details. */
export interface CatalogMaterialDto extends SupplierProductDto {
  supplier: {
    id: number;
    name: string;
    business_name: string | null;
    /** Filled in from the supplier's own profile; null until they set one up. */
    supplier_profile?: { location: string | null; contact_number: string | null } | null;
  };
}

export interface CatalogFilters {
  search?: string;
  category?: string;
  stock?: StockStatus;
}

export async function fetchMySupplierProducts(): Promise<SupplierProductDto[]> {
  return (await apiFetch("/api/supplier-products")) as SupplierProductDto[];
}

export async function createSupplierProduct(input: SupplierProductInput): Promise<SupplierProductDto> {
  return (await apiFetch("/api/supplier-products", {
    method: "POST",
    body: JSON.stringify(input),
  })) as SupplierProductDto;
}

export async function updateSupplierProduct(
  id: number,
  patch: Partial<SupplierProductInput>
): Promise<SupplierProductDto> {
  return (await apiFetch(`/api/supplier-products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })) as SupplierProductDto;
}

export async function deleteSupplierProduct(id: number): Promise<void> {
  await apiFetch(`/api/supplier-products/${id}`, { method: "DELETE" });
}

export interface BulkActivationResult {
  total: number;
  updated: number;
  skipped: number;
  failed: number;
  skipped_reasons: Record<string, number>;
  products: SupplierProductDto[];
}

export async function setAllSupplierProductsActive(isActive: boolean): Promise<BulkActivationResult> {
  return await apiFetch("/api/supplier-products/activation", {
    method: "PATCH", body: JSON.stringify({ is_active: isActive }),
  }) as BulkActivationResult;
}

export interface StockConfirmationReview {
  review_token: string;
  count: number;
  products: { id: number; name: string; stock: number; reserved: number; unit: string; price: number; is_active: boolean }[];
}

export type StockConfirmationResult = Omit<BulkActivationResult, "skipped_reasons">;

/** Preview is read-only; the signed review binds this supplier to these exact recorded quantities. */
export async function fetchStockConfirmationReview(): Promise<StockConfirmationReview> {
  return await apiFetch("/api/supplier-products/stock-confirmation") as StockConfirmationReview;
}

export async function confirmSupplierStock(reviewToken: string): Promise<StockConfirmationResult> {
  return await apiFetch("/api/supplier-products/stock-confirmation", {
    method: "PATCH", body: JSON.stringify({ confirmed: true, review_token: reviewToken }),
  }) as StockConfirmationResult;
}

export async function fetchMaterialCatalog(filters: CatalogFilters = {}): Promise<CatalogMaterialDto[]> {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.category) params.set("category", filters.category);
  if (filters.stock) params.set("stock", filters.stock);
  const query = params.toString();
  return (await apiFetch(`/api/materials${query ? `?${query}` : ""}`)) as CatalogMaterialDto[];
}
