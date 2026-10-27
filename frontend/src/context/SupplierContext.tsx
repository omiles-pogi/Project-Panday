import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  INITIAL_BIDS,
  INITIAL_ORDERS,
  type BidRequest,
  type Order,
  type OrderStatus,
  type Product,
} from "@/data/supplier";
import {
  createSupplierProduct,
  deleteSupplierProduct,
  fetchMySupplierProducts,
  updateSupplierProduct,
  type SupplierProductDto,
} from "@/services/api/supplierProducts";

interface SupplierContextValue {
  bids: BidRequest[];
  orders: Order[];
  products: Product[];
  submitBid: (id: number, bid: { total: number; deliveryDate: string; paymentTerms: string; notes: string }) => void;
  updateOrder: (id: string, status: OrderStatus, note: string) => void;
  updateProduct: (id: number, patch: Partial<Omit<Product, "id">>) => void;
  addProduct: (product: Omit<Product, "id" | "demand" | "trend">) => void;
  removeProduct: (id: number) => void;
}

const SupplierContext = createContext<SupplierContextValue | null>(null);

// The backend doesn't track demand/trend analytics yet — these stay cosmetic defaults client-side
// until that's built; everything else (name/category/unit/price/stock/minOrder/available) is real,
// persisted data the AI material estimator reads from directly.
function toProduct(dto: SupplierProductDto): Product {
  return {
    id: dto.id,
    name: dto.name,
    category: dto.category,
    unit: dto.unit,
    price: dto.price,
    stock: dto.stock,
    minOrder: dto.min_order,
    available: dto.available,
    demand: "Medium",
    trend: "flat",
  };
}

// Bids/orders are still in-memory sample data (no backend yet) — only product pricing/stock is
// real, since that's what the AI material estimator needs.
export function SupplierProvider({ children }: { children: ReactNode }) {
  const [bids, setBids] = useState(INITIAL_BIDS);
  const [orders, setOrders] = useState(INITIAL_ORDERS);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetchMySupplierProducts()
      .then((dtos) => setProducts(dtos.map(toProduct)))
      .catch(() => undefined);
  }, []);

  const submitBid = useCallback<SupplierContextValue["submitBid"]>((id, bid) => {
    setBids((list) =>
      list.map((b) =>
        b.id === id
          ? { ...b, status: "submitted", myBid: bid.total, deliveryDate: bid.deliveryDate, paymentTerms: bid.paymentTerms, notes: bid.notes }
          : b
      )
    );
  }, []);

  const updateOrder = useCallback<SupplierContextValue["updateOrder"]>((id, status, note) => {
    setOrders((list) =>
      list.map((o) =>
        o.id === id
          ? {
              ...o,
              status,
              note: note.trim() || o.note,
              // a delivered order has been paid in full once the client receives it
              amountPaid: status === "delivered" ? o.amount : o.amountPaid,
            }
          : o
      )
    );
  }, []);

  const updateProduct = useCallback<SupplierContextValue["updateProduct"]>((id, patch) => {
    updateSupplierProduct(id, {
      ...("price" in patch ? { price: patch.price } : {}),
      ...("stock" in patch ? { stock: patch.stock } : {}),
      ...("minOrder" in patch ? { min_order: patch.minOrder } : {}),
      ...("available" in patch ? { available: patch.available } : {}),
      ...("name" in patch ? { name: patch.name } : {}),
      ...("category" in patch ? { category: patch.category } : {}),
      ...("unit" in patch ? { unit: patch.unit } : {}),
    })
      .then((dto) => setProducts((list) => list.map((p) => (p.id === id ? toProduct(dto) : p))))
      .catch(() => undefined);
  }, []);

  const addProduct = useCallback<SupplierContextValue["addProduct"]>((product) => {
    createSupplierProduct({
      name: product.name,
      category: product.category,
      unit: product.unit,
      price: product.price,
      stock: product.stock,
      min_order: product.minOrder,
      available: product.available,
    })
      .then((dto) => setProducts((list) => [toProduct(dto), ...list]))
      .catch(() => undefined);
  }, []);

  const removeProduct = useCallback<SupplierContextValue["removeProduct"]>((id) => {
    deleteSupplierProduct(id)
      .then(() => setProducts((list) => list.filter((p) => p.id !== id)))
      .catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({ bids, orders, products, submitBid, updateOrder, updateProduct, addProduct, removeProduct }),
    [bids, orders, products, submitBid, updateOrder, updateProduct, addProduct, removeProduct]
  );

  return <SupplierContext.Provider value={value}>{children}</SupplierContext.Provider>;
}

export function useSupplier() {
  const ctx = useContext(SupplierContext);
  if (!ctx) throw new Error("useSupplier must be used within a SupplierProvider");
  return ctx;
}
