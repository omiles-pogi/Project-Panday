import RoleDrawer from "@/components/RoleDrawer";
import type { DrawerNavItem } from "@/components/RoleDrawerContent";

const NAV_ITEMS: DrawerNavItem[] = [
  { href: "/worker", label: "Dashboard", icon: "home-outline" },
  { href: "/worker/assignments", label: "My Assignments", icon: "briefcase-outline" },
  { href: "/worker/messages", label: "Messages", icon: "chatbubbles-outline", chatBadge: true },
  { href: "/worker/available", label: "Browse Projects", icon: "list-outline" },
  { href: "/worker/skills", label: "Skills & Profile", icon: "build-outline" },
];

export default function WorkerLayout() {
  return (
    <RoleDrawer
      role="worker"
      items={NAV_ITEMS}
      pages={[
        { name: "available", title: "Available Projects" },
        { name: "skills", title: "Skills & Profile" },
        { name: "chat/[id]", title: "Chat", detail: true },
        { name: "invite/[requestId]", title: "Project Invite", detail: true },
      ]}
    />
  );
}
