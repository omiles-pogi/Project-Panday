import RoleTabs from "@/components/RoleTabs";

// Four main tabs, like the homeowner app; sign-out and the tour live in the side menu.
export default function SupplierTabsLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: "index", title: "Supplier Dashboard", label: "Home", icon: "home-outline" },
        { name: "pricing", title: "Inventory", label: "Inventory", icon: "layers-outline" },
        { name: "orders", title: "Material Orders", label: "Orders", icon: "cube-outline" },
        { name: "bids", title: "Bid Requests", label: "Bids", icon: "pricetag-outline" },
        { name: "more", title: "More", label: "More", icon: "ellipsis-horizontal", hidden: true },
      ]}
    />
  );
}
