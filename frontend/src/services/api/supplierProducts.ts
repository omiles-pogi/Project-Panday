import { apiFetch } from "@/services/api/client";

export interface SupplierProductDto {
  id: number;
  supplier_id: number;
  name: string;
  category: string;
  unit: string;
  price: number;
  stock: number;
  min_order: number;
  available: boolean;
}

export interface SupplierProductInput {
  name: string;
  category: string;
  unit: string;
  price: number;
  stock: number;
  min_order: number;
  available?: boolean;
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
