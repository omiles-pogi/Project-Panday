import type { DrawerContentComponentProps } from "expo-router/drawer";
import RoleDrawerContent, { type DrawerNavItem } from "@/components/RoleDrawerContent";
import { useAuth } from "@/context/AuthContext";

const NAV_ITEMS: DrawerNavItem[] = [
  { href: "/homeowner", label: "Home", icon: "home-outline" },
  { href: "/homeowner/project-chat", label: "AI Plan", icon: "sparkles-outline" },
  { href: "/homeowner/progress", label: "Progress", icon: "stats-chart-outline" },
  { href: "/homeowner/history", label: "History", icon: "time-outline", matchChildren: true },
  { href: "/homeowner/budget-monitor", label: "Budget Monitor", icon: "pie-chart-outline" },
  { href: "/homeowner/marketplace", label: "Find Your Team", icon: "people-outline" },
  { href: "/homeowner/approvals", label: "Material Approvals", icon: "clipboard-outline" },
  { href: "/homeowner/messages", label: "Messages", icon: "chatbubbles-outline", chatBadge: true },
  { href: "/homeowner/supplier-catalog", label: "Supplier Catalog", icon: "storefront-outline" },
  { href: "/homeowner/profile", label: "Profile", icon: "person-outline" },
];

export default function HomeownerDrawerContent(props: DrawerContentComponentProps) {
  const { user } = useAuth();
  const items = user?.role === "homeowner" ? NAV_ITEMS : NAV_ITEMS.filter((item) => item.href !== "/homeowner/history");
  return <RoleDrawerContent {...props} role="homeowner" items={items} />;
}
