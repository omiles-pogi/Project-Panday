import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  INITIAL_BIDS,
  INITIAL_ORDERS,
  INITIAL_PRODUCTS,
  type BidRequest,
  type Order,
  type OrderStatus,
  type Product,
} from "@/data/supplier";

interface SupplierContextValue {
  bids: BidRequest[];
  orders: Order[];
  products: Product[];
  submitBid: (id: number, bid: { total: number; deliveryDate: string; paymentTerms: string; notes: string }) => void;
  updateOrder: (id: string, status: OrderStatus, note: string) => void;
  updateProduct: (id: number, patch: Partial<Omit<Product, "id">>) => void;
  addProduct: (product: Omit<Product, "id" | "demand" | "trend">) => void;
}

const SupplierContext = createContext<SupplierContextValue | null>(null);

// In-memory supplier workspace shared by the supplier tabs (no supplier API exists yet).
export function SupplierProvider({ children }: { children: ReactNode }) {
  const [bids, setBids] = useState(INITIAL_BIDS);
  const [orders, setOrders] = useState(INITIAL_ORDERS);
  const [products, setProducts] = useState(INITIAL_PRODUCTS);

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
    setProducts((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const addProduct = useCallback<SupplierContextValue["addProduct"]>((product) => {
    setProducts((list) => [
      { ...product, id: Math.max(0, ...list.map((p) => p.id)) + 1, demand: "Medium", trend: "flat" },
      ...list,
    ]);
  }, []);

  const value = useMemo(
    () => ({ bids, orders, products, submitBid, updateOrder, updateProduct, addProduct }),
    [bids, orders, products, submitBid, updateOrder, updateProduct, addProduct]
  );

  return <SupplierContext.Provider value={value}>{children}</SupplierContext.Provider>;
}

export function useSupplier() {
  const ctx = useContext(SupplierContext);
  if (!ctx) throw new Error("useSupplier must be used within a SupplierProvider");
  return ctx;
}
