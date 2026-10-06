import { router } from "expo-router";
import { MenuGrid, PageHeader, Screen, SignOutButton } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

const ROLES = [
  { href: "/homeowner", label: "Homeowner", icon: "home-outline" },
  { href: "/contractor", label: "Contractor", icon: "business-outline" },
  { href: "/worker", label: "Worker", icon: "hammer-outline" },
  { href: "/supplier", label: "Supplier", icon: "cube-outline" },
] as const;

export default function AdminHub() {
  const { user, logout } = useAuth();
  return (
    <Screen>
      <PageHeader title="Admin" subtitle={`${user?.name ?? ""} · pick a role to open its app`} />
      <MenuGrid items={ROLES} onSelect={(href) => router.push(href as never)} />
      <SignOutButton onPress={logout} />
    </Screen>
  );
}
