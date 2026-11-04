import type { QuoteStatus } from "@/services/api/quotes";

/** How a quote request reads, wherever it's shown. */
export const QUOTE_STATUS: Record<QuoteStatus, { label: string; color: string }> = {
  open: { label: "Open for bids", color: "#f59e0b" },
  awarded: { label: "Awarded", color: "#10b981" },
  cancelled: { label: "Cancelled", color: "#6b7280" },
};
