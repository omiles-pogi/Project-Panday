export function peso(amount: number): string {
  return `₱${Math.round(amount).toLocaleString()}`;
}

/** Peso formatted in whatever unit reads best: M for amounts in the millions, K in the thousands, plain otherwise — so a small job's estimate never rounds down to "₱0.00M". */
export function pesoCompact(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `₱${(amount / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `₱${(amount / 1_000).toFixed(0)}K`;
  return peso(amount);
}
