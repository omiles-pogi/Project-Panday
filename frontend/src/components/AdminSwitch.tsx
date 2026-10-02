import { router } from "expo-router";
import { Button } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

// Lets admins jump back to the role picker from any role's app; renders nothing for regular users.
export default function AdminSwitch() {
  const { user } = useAuth();
  if (user?.role !== "admin" && user?.role !== "superadmin") return null;
  return <Button label="⇄ Switch role (admin)" variant="tint" color="#f59e0b" onPress={() => router.replace("/admin" as never)} />;
}
