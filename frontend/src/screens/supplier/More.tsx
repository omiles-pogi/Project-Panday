import { PageHeader, Screen, SignOutButton } from "@/components/ui";
import AdminSwitch from "@/components/AdminSwitch";
import TourButton from "@/components/TourButton";
import { useAuth } from "@/context/AuthContext";

export default function More() {
  const { user, logout } = useAuth();
  return (
    <Screen>
      <PageHeader title="More" subtitle={user ? `${user.name} · Supplier` : undefined} />
      <TourButton />
      <AdminSwitch />
      <SignOutButton onPress={logout} />
    </Screen>
  );
}
