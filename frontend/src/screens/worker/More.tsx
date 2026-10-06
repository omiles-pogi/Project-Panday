import { router } from "expo-router";
import { MenuGrid, PageHeader, Screen, SignOutButton } from "@/components/ui";
import AdminSwitch from "@/components/AdminSwitch";
import TourButton from "@/components/TourButton";
import { useAuth } from "@/context/AuthContext";

const ITEMS = [
  { href: "/worker/timesheet", label: "Timesheet", icon: "time-outline" },
  { href: "/worker/earnings", label: "Earnings", icon: "wallet-outline" },
  { href: "/worker/skills", label: "Skills", icon: "build-outline" },
] as const;

export default function More() {
  const { user, logout } = useAuth();
  return (
    <Screen>
      <PageHeader title="More" subtitle={user ? `${user.name} · Skilled Worker` : undefined} />
      <MenuGrid items={ITEMS} onSelect={(href) => router.push(href as never)} />
      <TourButton />
      <AdminSwitch />
      <SignOutButton onPress={logout} />
    </Screen>
  );
}
