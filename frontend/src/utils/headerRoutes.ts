/** These screens render their actions inside the shared, in-flow homeowner header. */
export function usesInlineHomeownerHeader(pathname: string): boolean {
  const path = pathname.replace(/\/$/, "");
  return path === "/homeowner" || path === "/homeowner/history" || path === "/homeowner/project-chat";
}

export function usesInlineSupplierHistoryHeader(pathname: string): boolean {
  return pathname === "/supplier/history" || pathname.startsWith("/supplier/history/");
}

export function usesInlineSupplierDashboardHeader(pathname: string): boolean {
  return pathname.replace(/\/$/, "") === "/supplier";
}
