import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { INITIAL_BIDS, type BidRequest, type Product, type ProductInput } from "@/data/supplier";
import {
  createSupplierProduct,
  deleteSupplierProduct,
  fetchMySupplierProducts,
  updateSupplierProduct,
  type SupplierProductDto,
  type SupplierProductInput,
} from "@/services/api/supplierProducts";
import { fetchSupplierOrders } from "@/services/api/materialRequests";
import type { SupplierOrder } from "@/types/materialRequest";

interface SupplierContextValue {
  bids: BidRequest[];
  /** Real material orders routed to this supplier from homeowner-approved requests. */
  orders: SupplierOrder[];
  ordersLoading: boolean;
  ordersError: string | null;
  reloadOrders: () => void;
  /** Swaps in the server's copy after an order action, and refreshes inventory (reservations move stock). */
  replaceOrder: (order: SupplierOrder) => void;
  products: Product[];
  productsLoading: boolean;
  productsError: string | null;
  reloadProducts: () => void;
  submitBid: (id: number, bid: { total: number; deliveryDate: string; paymentTerms: string; notes: string }) => void;
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

// Bids are still in-memory sample data (no backend yet) — inventory and orders are real and persisted.
export function SupplierProvider({ children }: { children: ReactNode }) {
  const [bids, setBids] = useState(INITIAL_BIDS);
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
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

  const fetchOrders = useCallback(() => {
    fetchSupplierOrders()
      .then((list) => {
        setOrders(list);
        setOrdersError(null);
      })
      .catch((err) => setOrdersError(err instanceof Error ? err.message : "Failed to load orders."))
      .finally(() => setOrdersLoading(false));
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchOrders();
  }, [fetchProducts, fetchOrders]);

  const reloadProducts = useCallback(() => {
    setProductsLoading(true);
    fetchProducts();
  }, [fetchProducts]);

  const reloadOrders = useCallback(() => {
    setOrdersLoading(true);
    fetchOrders();
  }, [fetchOrders]);

  const replaceOrder = useCallback(
    (order: SupplierOrder) => {
      setOrders((list) => list.map((o) => (o.id === order.id ? order : o)));
      fetchProducts();
    },
    [fetchProducts]
  );

  const submitBid = useCallback<SupplierContextValue["submitBid"]>((id, bid) => {
    setBids((list) =>
      list.map((b) =>
        b.id === id
          ? { ...b, status: "submitted", myBid: bid.total, deliveryDate: bid.deliveryDate, paymentTerms: bid.paymentTerms, notes: bid.notes }
          : b
      )
    );
  }, []);

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
      bids,
      orders,
      ordersLoading,
      ordersError,
      reloadOrders,
      replaceOrder,
      products,
      productsLoading,
      productsError,
      reloadProducts,
      submitBid,
      addProduct,
      updateProduct,
      removeProduct,
    }),
    [
      bids,
      orders,
      ordersLoading,
      ordersError,
      reloadOrders,
      replaceOrder,
      products,
      productsLoading,
      productsError,
      reloadProducts,
      submitBid,
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
