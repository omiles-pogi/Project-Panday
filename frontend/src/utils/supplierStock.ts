/** A server attestation overrides historical import prose; old API responses retain the safe fallback. */
export function isSupplierStockConfirmed(product: { stockConfirmed?: boolean; description: string }): boolean {
  return product.stockConfirmed ?? !product.description.toLowerCase().includes("stock availability is unconfirmed");
}
