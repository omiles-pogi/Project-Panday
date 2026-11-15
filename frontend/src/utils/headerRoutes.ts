/** Role navigators own one in-flow header on every tab and secondary/detail route. */
export function usesInlineRoleHeader(pathname: string, role?: string): boolean {
  if (!role || !["homeowner", "supplier", "worker", "contractor"].includes(role)) return false;
  const path = pathname.replace(/\/$/, "");
  const root = `/${role}`;
  return path === root || path.startsWith(`${root}/`);
}
