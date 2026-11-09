import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Product, ProductInput } from "@/data/supplier";
import {
  createSupplierProduct,
  deleteSupplierProduct,
  fetchMySupplierProducts,
  updateSupplierProduct,
  type SupplierProductDto,
  type SupplierProductInput,
} from "@/services/api/supplierProducts";
import { fetchSupplierFulfillments } from "@/services/api/materialRequests";
import type { SupplierFulfillment } from "@/types/materialRequest";

interface SupplierContextValue {
  /** Real material fulfillments routed to this supplier from homeowner-approved requests. */
  fulfillments: SupplierFulfillment[];
  fulfillmentsLoading: boolean;
  fulfillmentsError: string | null;
  reloadFulfillments: () => void;
  /** Swaps in the server's copy after a fulfillment action, and refreshes inventory (reservations move stock). */
  replaceFulfillment: (order: SupplierFulfillment) => void;
  products: Product[];
  productsLoading: boolean;
  productsError: string | null;
  reloadProducts: () => void;
  /** Inventory mutations resolve once the backend has saved, and reject with its validation
   * message — callers show that error instead of the change silently not sticking. */
  addProduct: (product: ProductInput) => Promise<void>;
  updateProduct: (id: number, patch: Partial<ProductInput>) => Promise<void>;
  removeProduct: (id: number) => Promise<void>;
}

const SupplierContext = createContext<SupplierContextValue | null>(null);

function toProduct(dto: SupplierProductDto): Product {
  return {
    id: dto.id,
    name: dto.name,
    category: dto.category,
    description: dto.description ?? "",
    unit: dto.unit,
    price: dto.price,
    stock: dto.stock,
    reserved: dto.reserved,
    availableQuantity: dto.available_quantity,
    minOrder: dto.min_order,
    isActive: dto.is_active,
    stockStatus: dto.stock_status,
  };
}

function toInput(patch: Partial<ProductInput>): Partial<SupplierProductInput> {
  return {
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.category !== undefined ? { category: patch.category } : {}),
    ...(patch.description !== undefined ? { description: patch.description.trim() || null } : {}),
    ...(patch.unit !== undefined ? { unit: patch.unit } : {}),
    ...(patch.price !== undefined ? { price: patch.price } : {}),
    ...(patch.stock !== undefined ? { stock: patch.stock } : {}),
    ...(patch.minOrder !== undefined ? { min_order: patch.minOrder } : {}),
    ...(patch.isActive !== undefined ? { is_active: patch.isActive } : {}),
  };
}

export function SupplierProvider({ children }: { children: ReactNode }) {
  const [fulfillments, setFulfillments] = useState<SupplierFulfillment[]>([]);
  const [fulfillmentsLoading, setFulfillmentsLoading] = useState(true);
  const [fulfillmentsError, setFulfillmentsError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);

  const fetchProducts = useCallback(() => {
    fetchMySupplierProducts()
      .then((dtos) => {
        setProducts(dtos.map(toProduct));
        setProductsError(null);
      })
      .catch((err) => setProductsError(err instanceof Error ? err.message : "Failed to load inventory."))
      .finally(() => setProductsLoading(false));
  }, []);

  const fetchFulfillments = useCallback(() => {
    fetchSupplierFulfillments()
      .then((list) => {
        setFulfillments(list);
        setFulfillmentsError(null);
      })
      .catch((err) => setFulfillmentsError(err instanceof Error ? err.message : "Failed to load fulfillments."))
      .finally(() => setFulfillmentsLoading(false));
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchFulfillments();
  }, [fetchProducts, fetchFulfillments]);

  const reloadProducts = useCallback(() => {
    setProductsLoading(true);
    fetchProducts();
  }, [fetchProducts]);

  const reloadFulfillments = useCallback(() => {
    setFulfillmentsLoading(true);
    fetchFulfillments();
  }, [fetchFulfillments]);

  const replaceFulfillment = useCallback(
    (order: SupplierFulfillment) => {
      setFulfillments((list) => list.map((o) => (o.id === order.id ? order : o)));
      fetchProducts();
    },
    [fetchProducts]
  );

  const addProduct = useCallback<SupplierContextValue["addProduct"]>(async (product) => {
    const dto = await createSupplierProduct(toInput(product) as SupplierProductInput);
    setProducts((list) => [toProduct(dto), ...list]);
  }, []);

  const updateProduct = useCallback<SupplierContextValue["updateProduct"]>(async (id, patch) => {
    const dto = await updateSupplierProduct(id, toInput(patch));
    setProducts((list) => list.map((p) => (p.id === id ? toProduct(dto) : p)));
  }, []);

  const removeProduct = useCallback<SupplierContextValue["removeProduct"]>(async (id) => {
    await deleteSupplierProduct(id);
    setProducts((list) => list.filter((p) => p.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      fulfillments,
      fulfillmentsLoading,
      fulfillmentsError,
      reloadFulfillments,
      replaceFulfillment,
      products,
      productsLoading,
      productsError,
      reloadProducts,
      addProduct,
      updateProduct,
      removeProduct,
    }),
    [
      fulfillments,
      fulfillmentsLoading,
      fulfillmentsError,
      reloadFulfillments,
      replaceFulfillment,
      products,
      productsLoading,
      productsError,
      reloadProducts,
      addProduct,
      updateProduct,
      removeProduct,
    ]
  );

  return <SupplierContext.Provider value={value}>{children}</SupplierContext.Provider>;
}

export function useSupplier() {
  const ctx = useContext(SupplierContext);
  if (!ctx) throw new Error("useSupplier must be used within a SupplierProvider");
  return ctx;
}
