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

export function usesInlineContractorHeader(pathname: string): boolean {
  const path = pathname.replace(/\/$/, "");
  return path === "/contractor" || path === "/contractor/history" || path.startsWith("/contractor/history/");
}

export function usesInlineWorkerHeader(pathname: string): boolean {
  const path = pathname.replace(/\/$/, "");
  return ["/worker", "/worker/available", "/worker/assignments", "/worker/skills", "/worker/messages", "/worker/more", "/worker/history"].includes(path)
    || path.startsWith("/worker/history/");
}
