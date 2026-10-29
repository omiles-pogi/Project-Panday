import RoleDrawer from "@/components/RoleDrawer";
import type { DrawerNavItem } from "@/components/RoleDrawerContent";

const NAV_ITEMS: DrawerNavItem[] = [
  { href: "/worker", label: "Dashboard", icon: "home-outline" },
  { href: "/worker/assignments", label: "My Assignments", icon: "briefcase-outline" },
  { href: "/worker/messages", label: "Messages", icon: "chatbubbles-outline", chatBadge: true },
  { href: "/worker/daily-log", label: "Daily Work Log", icon: "document-text-outline" },
  { href: "/worker/attendance", label: "Attendance", icon: "calendar-outline" },
  { href: "/worker/available", label: "Browse Projects", icon: "list-outline" },
  { href: "/worker/timesheet", label: "Timesheet", icon: "time-outline" },
  { href: "/worker/earnings", label: "Earnings", icon: "wallet-outline" },
  { href: "/worker/skills", label: "Skills & Profile", icon: "build-outline" },
];

export default function WorkerLayout() {
  return (
    <RoleDrawer
      role="worker"
      items={NAV_ITEMS}
      pages={[
        { name: "available", title: "Available Projects" },
        { name: "timesheet", title: "Timesheet" },
        { name: "earnings", title: "Earnings" },
        { name: "skills", title: "Skills & Profile" },
        { name: "chat/[id]", title: "Chat", detail: true },
      ]}
    />
  );
}
