import RoleDrawer from "@/components/RoleDrawer";
import type { DrawerNavItem } from "@/components/RoleDrawerContent";

const NAV_ITEMS: DrawerNavItem[] = [
  { href: "/contractor", label: "Dashboard", icon: "home-outline" },
  { href: "/contractor/available", label: "Browse Projects", icon: "list-outline" },
  { href: "/contractor/projects", label: "My Projects", icon: "business-outline" },
  { href: "/contractor/material-requests", label: "Material Requests", icon: "clipboard-outline" },
  { href: "/contractor/messages", label: "Messages", icon: "chatbubbles-outline", chatBadge: true },
  { href: "/contractor/materials", label: "Supplier Materials", icon: "storefront-outline" },
  { href: "/contractor/report", label: "Progress Report", icon: "document-text-outline" },
  { href: "/contractor/profile", label: "Profile", icon: "person-outline" },
  { href: "/contractor/capacity-monitor", label: "Capacity Monitor", icon: "sparkles-outline" },
  { href: "/contractor/equipment-schedule", label: "Equipment Schedule", icon: "calendar-outline" },
  { href: "/contractor/progress-analysis", label: "Progress Analysis", icon: "trending-up-outline" },
  { href: "/contractor/weekly-analytics", label: "Weekly Analytics", icon: "stats-chart-outline" },
];

export default function ContractorLayout() {
  return (
    <RoleDrawer
      role="contractor"
      items={NAV_ITEMS}
      pages={[
        { name: "profile", title: "Profile" },
        { name: "capacity-monitor", title: "Capacity Monitor" },
        { name: "equipment-schedule", title: "Equipment Schedule" },
        { name: "progress-analysis", title: "Progress Analysis" },
        { name: "weekly-analytics", title: "Weekly Analytics" },
        { name: "materials", title: "Supplier Materials" },
        { name: "material-request/[id]", title: "Material Request", detail: true },
        { name: "chat/[id]", title: "Chat", detail: true },
      ]}
    />
  );
}
