/** Display-only: preserve stored provenance and stock-verification notes for inventory/import logic. */
export function publicMaterialDescription(description: string | null | undefined): string | null {
  if (!description) return null;
  const internalLine = /^(?:Specification not supplied\b|Stock availability is unconfirmed\b|Source (?:category|reference|supplier|location)\s*:|Complete listing\s*:)/i;
  const visible = description.split(/\r?\n/).filter(line => !internalLine.test(line.trim())).join("\n").trim();
  return visible || null;
}
