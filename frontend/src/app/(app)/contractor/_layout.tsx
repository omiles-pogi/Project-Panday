import RoleDrawer from "@/components/RoleDrawer";
import ContractorFloatingTabBar from "@/components/ContractorFloatingTabBar";
import type { DrawerNavItem } from "@/components/RoleDrawerContent";

const NAV_ITEMS: DrawerNavItem[] = [
  { href: "/contractor", label: "Dashboard", icon: "home-outline" },
  { href: "/contractor/available", label: "Browse Projects", icon: "list-outline" },
  { href: "/contractor/projects", label: "My Projects", icon: "business-outline" },
  { href: "/contractor/history", label: "History", icon: "time-outline", matchChildren: true },
  { href: "/contractor/material-requests", label: "Material Requests", icon: "clipboard-outline" },
  { href: "/contractor/messages", label: "Messages", icon: "chatbubbles-outline", chatBadge: true },
  { href: "/contractor/materials", label: "Supplier Materials", icon: "storefront-outline" },
  { href: "/contractor/profile", label: "Profile", icon: "person-outline" },
];

export default function ContractorLayout() {
  return (
    <RoleDrawer
      role="contractor"
      footer={<ContractorFloatingTabBar />}
      items={NAV_ITEMS}
      pages={[
        { name: "history", title: "History", headerShown: false },
        { name: "profile", title: "Profile" },
        { name: "materials", title: "Supplier Materials" },
        { name: "material-request/[id]", title: "Material Request", detail: true },
        { name: "chat/[id]", title: "Chat", detail: true },
        { name: "invite/[requestId]", title: "Project Invite", detail: true },
      ]}
    />
  );
}
