import RoleTabs from "@/components/RoleTabs";

export default function ContractorTabsLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: "index", title: "Contractor Dashboard", label: "Home", icon: "home-outline" },
        { name: "available", title: "Available Projects", label: "Browse", icon: "list-outline" },
        { name: "projects", title: "My Projects", label: "Projects", icon: "business-outline" },
        { name: "report", title: "Progress Report", label: "Report", icon: "document-text-outline" },
        { name: "more", title: "More", label: "More", icon: "ellipsis-horizontal" },
      ]}
    />
  );
}
