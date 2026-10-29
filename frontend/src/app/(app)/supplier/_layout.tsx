import RoleDrawer from "@/components/RoleDrawer";
import type { DrawerNavItem } from "@/components/RoleDrawerContent";
import { SupplierProvider } from "@/context/SupplierContext";

const NAV_ITEMS: DrawerNavItem[] = [
  { href: "/supplier", label: "Dashboard", icon: "home-outline" },
  { href: "/supplier/pricing", label: "Inventory", icon: "layers-outline" },
  { href: "/supplier/orders", label: "Material Orders", icon: "cube-outline" },
  { href: "/supplier/bids", label: "Bid Requests", icon: "pricetag-outline" },
];

export default function SupplierLayout() {
  return (
    <SupplierProvider>
      <RoleDrawer role="supplier" items={NAV_ITEMS} pages={[]} />
    </SupplierProvider>
  );
}
