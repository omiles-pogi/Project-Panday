import RoleTabs from "@/components/RoleTabs";

// Four main tabs, like the homeowner app; sign-out and the tour live in the side menu.
export default function SupplierTabsLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: "index", title: "Supplier Dashboard", label: "Home", icon: "home-outline" },
        { name: "pricing", title: "Inventory", label: "Inventory", icon: "layers-outline" },
        { name: "orders", title: "Material Fulfillment", label: "Fulfillment", icon: "cube-outline" },
        { name: "more", title: "More", label: "More", icon: "ellipsis-horizontal", hidden: true },
      ]}
    />
  );
}
