import { apiFetch } from "@/services/api/client";

export type QuoteStatus = "open" | "awarded" | "cancelled";
export type BidStatus = "pending" | "accepted" | "rejected" | "withdrawn";

export interface QuoteItem {
  id: number;
  materialName: string;
  unit: string;
  quantity: number;
}

export interface QuoteBid {
  id: number;
  supplierId: number;
  supplierName: string | null;
  total: number;
  deliveryDays: number;
  note: string | null;
  status: BidStatus;
  /** The cheapest bid still in the running. */
  isLowest: boolean;
  items: { itemId: number; unitPrice: number; subtotal: number }[];
}

/** A quote request as the homeowner or contractor sees it: every bid on it, cheapest first. */
export interface QuoteRequest {
  id: number;
  projectId: number;
  projectTitle: string | null;
  location: string | null;
  title: string;
  notes: string | null;
  neededBy: string | null;
  status: QuoteStatus;
  awardedBidId: number | null;
  createdAt: string;
  requestedBy: { id: number | null; name: string | null; role: string | null };
  items: QuoteItem[];
  bids: QuoteBid[];
}

/** A quote request as a supplier sees it: the materials wanted and only their own bid. */
export interface SupplierQuoteRequest {
  id: number;
  projectTitle: string | null;
  location: string | null;
  title: string;
  notes: string | null;
  neededBy: string | null;
  status: QuoteStatus;
  createdAt: string;
  /** How many suppliers have bid so far, without saying who or how much. */
  bidCount: number;
  items: QuoteItem[];
  myBid: {
    id: number;
    total: number;
    deliveryDays: number;
    note: string | null;
    status: BidStatus;
    items: { itemId: number; unitPrice: number }[];
  } | null;
}

export interface NewQuoteRequest {
  title: string;
  notes?: string;
  /** "YYYY-MM-DD" */
  needed_by?: string;
  items: { material_name: string; unit: string; quantity: number }[];
}

export interface BidInput {
  delivery_days: number;
  note?: string;
  /** A price for every item on the request. */
  items: { item_id: number; unit_price: number }[];
}

export async function fetchQuoteRequests(): Promise<QuoteRequest[]> {
  return (await apiFetch("/api/quote-requests")) as QuoteRequest[];
}

export async function createQuoteRequest(projectId: number, input: NewQuoteRequest): Promise<QuoteRequest> {
  return (await apiFetch(`/api/projects/${projectId}/quote-requests`, { method: "POST", body: JSON.stringify(input) })) as QuoteRequest;
}

export async function awardQuote(requestId: number, bidId: number): Promise<QuoteRequest> {
  return (await apiFetch(`/api/quote-requests/${requestId}/award`, { method: "POST", body: JSON.stringify({ bid_id: bidId }) })) as QuoteRequest;
}

export async function cancelQuoteRequest(requestId: number): Promise<QuoteRequest> {
  return (await apiFetch(`/api/quote-requests/${requestId}/cancel`, { method: "POST" })) as QuoteRequest;
}

export async function fetchSupplierQuotes(): Promise<SupplierQuoteRequest[]> {
  return (await apiFetch("/api/supplier/quote-requests")) as SupplierQuoteRequest[];
}

export async function submitBid(requestId: number, input: BidInput): Promise<SupplierQuoteRequest> {
  return (await apiFetch(`/api/quote-requests/${requestId}/bid`, { method: "PUT", body: JSON.stringify(input) })) as SupplierQuoteRequest;
}

export async function withdrawBid(requestId: number): Promise<SupplierQuoteRequest> {
  return (await apiFetch(`/api/quote-requests/${requestId}/bid`, { method: "DELETE" })) as SupplierQuoteRequest;
}
