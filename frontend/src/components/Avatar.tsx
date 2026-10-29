import { Text, View } from "react-native";
import { roleColors } from "@/theme/colors";
import type { UserRole } from "@/types/auth";

/** Initials avatar tinted by role — users have no profile photos, so this matches the drawer's
 * profile chip instead. */
export default function Avatar({ name, role, size = 40 }: { name: string; role?: UserRole; size?: number }) {
  const color = (role && role in roleColors ? roleColors[role as keyof typeof roleColors] : undefined) ?? "#6b7280";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <View
      className="items-center justify-center"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${color}30` }}
    >
      <Text style={{ color, fontWeight: "700", fontSize: Math.round(size * 0.36) }}>{initials || "?"}</Text>
    </View>
  );
}
