import { router } from "expo-router";
import { MenuGrid, PageHeader, Screen, SignOutButton } from "@/components/ui";
import AdminSwitch from "@/components/AdminSwitch";
import { useAuth } from "@/context/AuthContext";

const ITEMS = [
  { href: "/contractor/capacity-monitor", label: "Capacity", icon: "🤖" },
  { href: "/contractor/equipment-schedule", label: "Equipment", icon: "📅" },
  { href: "/contractor/progress-analysis", label: "Analysis", icon: "📈" },
  { href: "/contractor/weekly-analytics", label: "Weekly", icon: "📊" },
];

export default function More() {
  const { user, logout } = useAuth();
  return (
    <Screen>
      <PageHeader title="More" subtitle={user ? `${user.name} · Contractor` : undefined} />
      <MenuGrid items={ITEMS} onSelect={(href) => router.push(href as never)} />
      <AdminSwitch />
      <SignOutButton onPress={logout} />
    </Screen>
  );
}
