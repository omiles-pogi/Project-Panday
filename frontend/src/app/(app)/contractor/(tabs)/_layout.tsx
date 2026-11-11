import RoleTabs from "@/components/RoleTabs";

// Four main tabs, like the homeowner app; the rest stay reachable from the side menu.
export default function ContractorTabsLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: "index", title: "Contractor Dashboard", label: "Home", icon: "home-outline" },
        { name: "available", title: "Available Projects", label: "Browse", icon: "list-outline" },
        { name: "projects", title: "My Projects", label: "Projects", icon: "business-outline" },
        { name: "material-requests", title: "Material Requests", label: "Requests", icon: "clipboard-outline" },
        { name: "messages", title: "Messages", label: "Chat", icon: "chatbubbles-outline", hidden: true },
        { name: "more", title: "More", label: "More", icon: "ellipsis-horizontal", hidden: true },
      ]}
    />
  );
}
