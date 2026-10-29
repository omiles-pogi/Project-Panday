import type { DrawerContentComponentProps } from "expo-router/drawer";
import RoleDrawerContent, { type DrawerNavItem } from "@/components/RoleDrawerContent";

const NAV_ITEMS: DrawerNavItem[] = [
  { href: "/homeowner", label: "Home", icon: "home-outline" },
  { href: "/homeowner/project-chat", label: "AI Plan", icon: "sparkles-outline" },
  { href: "/homeowner/progress", label: "Progress", icon: "stats-chart-outline" },
  { href: "/homeowner/budget-monitor", label: "Budget Monitor", icon: "pie-chart-outline" },
  { href: "/homeowner/budget-generator", label: "Budget Generator", icon: "wallet-outline" },
  { href: "/homeowner/material-estimator", label: "Materials", icon: "layers-outline" },
  { href: "/homeowner/marketplace", label: "Find Your Team", icon: "people-outline" },
  { href: "/homeowner/approvals", label: "Material Approvals", icon: "clipboard-outline" },
  { href: "/homeowner/messages", label: "Messages", icon: "chatbubbles-outline", chatBadge: true },
  { href: "/homeowner/supplier-catalog", label: "Supplier Catalog", icon: "storefront-outline" },
];

export default function HomeownerDrawerContent(props: DrawerContentComponentProps) {
  return <RoleDrawerContent {...props} role="homeowner" items={NAV_ITEMS} />;
}
