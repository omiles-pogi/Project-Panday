import RoleTabs from "@/components/RoleTabs";

export default function ContractorTabsLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: "index", title: "Contractor Dashboard", label: "Home", icon: "⊞" },
        { name: "available", title: "Available Projects", label: "Browse", icon: "📋" },
        { name: "projects", title: "My Projects", label: "Projects", icon: "🏗️" },
        { name: "report", title: "Progress Report", label: "Report", icon: "📝" },
        { name: "more", title: "More", label: "More", icon: "⋯" },
      ]}
    />
  );
}
