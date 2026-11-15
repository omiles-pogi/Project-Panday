import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Product, ProductInput } from "@/data/supplier";
import {
  createSupplierProduct,
  deleteSupplierProduct,
  fetchMySupplierProducts,
  updateSupplierProduct,
  setAllSupplierProductsActive,
  confirmSupplierStock,
  type StockConfirmationResult,
  type BulkActivationResult,
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
  setAllProductsActive: (active: boolean) => Promise<BulkActivationResult>;
  confirmStock: (reviewToken: string) => Promise<StockConfirmationResult>;
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
    activationEligible: dto.activation_eligible,
    activationBlockReason: dto.activation_block_reason,
    stockConfirmed: dto.stock_confirmed,
    stockConfirmedAt: dto.stock_confirmed_at,
    stockConfirmedBy: dto.stock_confirmed_by,
    stockConfirmedQuantity: dto.stock_confirmed_quantity,
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
  const productsRevision = useRef(0);
  const availabilityInFlight = useRef(false);

  const fetchProducts = useCallback(() => {
    const revision = ++productsRevision.current;
    fetchMySupplierProducts()
      .then((dtos) => {
        if (revision !== productsRevision.current) return;
        setProducts(dtos.map(toProduct));
        setProductsError(null);
      })
      .catch((err) => { if (revision === productsRevision.current) setProductsError(err instanceof Error ? err.message : "Failed to load inventory."); })
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
    if (availabilityInFlight.current) throw new Error("An inventory update is already running.");
    availabilityInFlight.current = true;
    productsRevision.current++;
    try {
      const dto = await createSupplierProduct(toInput(product) as SupplierProductInput);
      productsRevision.current++;
      setProducts((list) => [toProduct(dto), ...list]);
    } finally {
      availabilityInFlight.current = false;
    }
  }, []);

  const updateProduct = useCallback<SupplierContextValue["updateProduct"]>(async (id, patch) => {
    if (availabilityInFlight.current) throw new Error("An inventory availability update is already running.");
    availabilityInFlight.current = true;
    productsRevision.current++;
    try {
      const dto = await updateSupplierProduct(id, toInput(patch));
      productsRevision.current++;
      setProducts((list) => list.map((p) => (p.id === id ? toProduct(dto) : p)));
    } finally {
      availabilityInFlight.current = false;
    }
  }, []);

  const applyInventory = useCallback((dtos: SupplierProductDto[]) => {
    productsRevision.current++;
    const server = new Map(dtos.map((dto) => [dto.id, toProduct(dto)]));
    setProducts((current) => {
      const known = new Set(current.map((p) => p.id));
      return [...current.filter((p) => server.has(p.id)).map((p) => server.get(p.id)!),
        ...dtos.filter((p) => !known.has(p.id)).map(toProduct)];
    });
    setProductsError(null);
  }, []);

  const setAllProductsActive = useCallback<SupplierContextValue["setAllProductsActive"]>(async (active) => {
    if (availabilityInFlight.current) throw new Error("An inventory availability update is already running.");
    availabilityInFlight.current = true;
    productsRevision.current++;
    try {
      const result = await setAllSupplierProductsActive(active);
      // Preserve visible row order and filters; reconcile only after server confirmation.
      applyInventory(result.products);
      return result;
    } finally {
      availabilityInFlight.current = false;
    }
  }, [applyInventory]);

  const confirmStock = useCallback<SupplierContextValue["confirmStock"]>(async (reviewToken) => {
    if (availabilityInFlight.current) throw new Error("An inventory availability update is already running.");
    availabilityInFlight.current = true;
    productsRevision.current++;
    try {
      const result = await confirmSupplierStock(reviewToken);
      applyInventory(result.products);
      return result;
    } finally {
      availabilityInFlight.current = false;
    }
  }, [applyInventory]);

  const removeProduct = useCallback<SupplierContextValue["removeProduct"]>(async (id) => {
    if (availabilityInFlight.current) throw new Error("An inventory update is already running.");
    availabilityInFlight.current = true;
    productsRevision.current++;
    try {
      await deleteSupplierProduct(id);
      productsRevision.current++;
      setProducts((list) => list.filter((p) => p.id !== id));
    } finally {
      availabilityInFlight.current = false;
    }
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
      setAllProductsActive,
      confirmStock,
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
      setAllProductsActive,
      confirmStock,
    ]
  );

  return <SupplierContext.Provider value={value}>{children}</SupplierContext.Provider>;
}

export function useSupplier() {
  const ctx = useContext(SupplierContext);
  if (!ctx) throw new Error("useSupplier must be used within a SupplierProvider");
  return ctx;
}
