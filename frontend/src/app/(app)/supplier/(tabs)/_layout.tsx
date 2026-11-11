import RoleTabs from "@/components/RoleTabs";

// Keep all existing routes; the supplier drawer supplies one floating footer for these and its secondary pages.
export default function SupplierTabsLayout() {
  return (
    <RoleTabs
      hideBar
      tabs={[
        { name: "index", title: "Supplier Dashboard", label: "Home", icon: "home-outline" },
        { name: "pricing", title: "Inventory", label: "Inventory", icon: "layers-outline" },
        { name: "fulfillment", title: "Material Fulfillment", label: "Fulfillment", icon: "cube-outline" },
        { name: "more", title: "More", label: "More", icon: "ellipsis-horizontal", hidden: true },
      ]}
    />
  );
}
