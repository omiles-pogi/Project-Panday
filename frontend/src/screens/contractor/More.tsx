import { router } from "expo-router";
import { MenuGrid, PageHeader, Screen, SignOutButton } from "@/components/ui";
import AdminSwitch from "@/components/AdminSwitch";
import TourButton from "@/components/TourButton";
import { useAuth } from "@/context/AuthContext";

const ITEMS = [
  { href: "/contractor/profile", label: "Profile", icon: "person-outline" },
  { href: "/contractor/material-requests", label: "Material Requests", icon: "clipboard-outline" },
  { href: "/contractor/materials", label: "Supplier Materials", icon: "storefront-outline" },
] as const;

export default function More() {
  const { user, logout } = useAuth();
  return (
    <Screen>
      <PageHeader title="More" subtitle={user ? `${user.name} · Contractor` : undefined} />
      <MenuGrid items={ITEMS} onSelect={(href) => router.push(href as never)} />
      <TourButton />
      <AdminSwitch />
      <SignOutButton onPress={logout} />
    </Screen>
  );
}
