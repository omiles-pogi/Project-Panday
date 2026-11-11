import RoleDrawer from "@/components/RoleDrawer";
import type { DrawerNavItem } from "@/components/RoleDrawerContent";
import { SupplierProvider } from "@/context/SupplierContext";
import SupplierFloatingTabBar from "@/components/SupplierFloatingTabBar";

const NAV_ITEMS: DrawerNavItem[] = [
  { href: "/supplier", label: "Dashboard", icon: "home-outline" },
  { href: "/supplier/pricing", label: "Inventory", icon: "layers-outline" },
  { href: "/supplier/fulfillment", label: "Material Fulfillment", icon: "cube-outline" },
  { href: "/supplier/history", label: "History", icon: "time-outline", matchChildren: true },
  { href: "/supplier/profile", label: "Profile", icon: "person-outline" },
];

export default function SupplierLayout() {
  return (
    <SupplierProvider>
      <RoleDrawer role="supplier" items={NAV_ITEMS} footer={<SupplierFloatingTabBar />} pages={[
          { name: "profile", title: "Profile" },
          { name: "history", title: "History", headerShown: false },
        ]} />
    </SupplierProvider>
  );
}
