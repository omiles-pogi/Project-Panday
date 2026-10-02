import { Text, View, Pressable } from "react-native";
import AdminSwitch from "@/components/AdminSwitch";
import { useAuth } from "@/context/AuthContext";
import { roleColors } from "@/theme/colors";
import type { Role } from "@/types/auth";

const LABELS: Record<Role, string> = {
  homeowner: "Homeowner",
  contractor: "Contractor",
  supplier: "Supplier",
  worker: "Skilled Worker",
};

export default function RoleStub({ role }: { role: Role }) {
  const { logout } = useAuth();
  const color = roleColors[role];

  return (
    <View className="flex-1 items-center justify-center bg-background px-8">
      <View
        className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
        style={{ backgroundColor: `${color}20` }}
      >
        <Text className="text-3xl">🚧</Text>
      </View>
      <Text className="text-foreground font-bold text-lg mb-1">{LABELS[role]} app coming soon</Text>
      <Text className="text-muted-foreground text-sm text-center mb-8">
        The {LABELS[role].toLowerCase()} screens haven’t been ported to mobile yet — only the
        homeowner AI planner flow has been built out so far.
      </Text>
      <AdminSwitch />
      <Pressable onPress={logout} className="mt-3 px-5 py-2.5 rounded-xl bg-card border border-border">
        <Text className="text-danger text-sm font-semibold">Sign Out</Text>
      </Pressable>
    </View>
  );
}
