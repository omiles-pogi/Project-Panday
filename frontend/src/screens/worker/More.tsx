import { router } from "expo-router";
import { MenuGrid, PageHeader, Screen, SignOutButton } from "@/components/ui";
import AdminSwitch from "@/components/AdminSwitch";
import { useAuth } from "@/context/AuthContext";

const ITEMS = [
  { href: "/worker/timesheet", label: "Timesheet", icon: "🕐" },
  { href: "/worker/earnings", label: "Earnings", icon: "₱" },
  { href: "/worker/skills", label: "Skills", icon: "🔧" },
];

export default function More() {
  const { user, logout } = useAuth();
  return (
    <Screen>
      <PageHeader title="More" subtitle={user ? `${user.name} · Skilled Worker` : undefined} />
      <MenuGrid items={ITEMS} onSelect={(href) => router.push(href as never)} />
      <AdminSwitch />
      <SignOutButton onPress={logout} />
    </Screen>
  );
}
