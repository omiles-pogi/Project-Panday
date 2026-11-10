/** Keep six individual slots so deleting a middle digit does not shift the others. */
export function editOtp(current: readonly string[], index: number, text: string): { digits: string[]; focus: number } {
  const digits = [...current];
  const numeric = text.replace(/[^0-9]/g, "").slice(0, 6);
  if (text && !numeric) return { digits, focus: index };
  if (!numeric) {
    digits[index] = "";
    return { digits, focus: index };
  }
  const start = numeric.length === 6 ? 0 : index;
  for (let offset = 0; offset < numeric.length && start + offset < 6; offset++) digits[start + offset] = numeric[offset];
  return { digits, focus: Math.min(5, start + numeric.length) };
}
