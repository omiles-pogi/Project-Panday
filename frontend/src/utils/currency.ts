export function peso(amount: number): string {
  return `₱${Math.round(amount).toLocaleString()}`;
}
