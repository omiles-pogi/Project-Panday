import RoleTabs from "@/components/RoleTabs";

export default function SupplierTabsLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: "index", title: "Supplier Dashboard", label: "Home", icon: "home-outline" },
        { name: "bids", title: "Bid Requests", label: "Bids", icon: "pricetag-outline" },
        { name: "orders", title: "Orders", label: "Orders", icon: "cube-outline" },
        { name: "pricing", title: "Pricing & Stock", label: "Pricing", icon: "cash-outline" },
        { name: "more", title: "More", label: "More", icon: "ellipsis-horizontal" },
      ]}
    />
  );
}
