export interface SupplierHistoryProject {
  id: number;
  title: string;
  homeownerName: string;
  lastReceivedAt: string | null;
  receiptCount: number;
  /** Each supplied line on each receipt counts once, even if the material name repeats. */
  lineCount: number;
  totalAmount: number | null;
  knownSubtotal: number;
  missingPriceCount: number;
}

export interface SuppliedHistoryItem {
  id: number;
  fulfillmentId: number;
  materialRequestId: number;
  receivedAt: string | null;
  fulfillmentStatus: "received";
  itemStatus: "confirmed";
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number | null;
  lineTotal: number | null;
}

export interface SupplierHistoryDetails extends SupplierHistoryProject {
  projectType: string | null;
  location: string | null;
  items: SuppliedHistoryItem[];
}
