import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function ComingSoon({ title }: { title: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-background px-8">
      <Ionicons name="construct-outline" size={32} color="#6b7280" style={{ marginBottom: 12 }} />
      <Text className="text-foreground font-bold text-lg mb-1">{title}</Text>
      <Text className="text-muted-foreground text-sm text-center">
        This screen hasn’t been ported to the mobile app yet.
      </Text>
    </View>
  );
}
