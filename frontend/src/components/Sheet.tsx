import { type ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Bottom sheet for forms (submit bid, update order, edit product).
export default function Sheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Close" />
        <View
          className="bg-card border border-border rounded-t-3xl self-center w-full"
          style={{ maxHeight: "90%", maxWidth: 520 }}
        >
          <View className="flex-row items-start justify-between px-5 pt-5 pb-3">
            <View className="flex-1 pr-3">
              <Text className="text-lg font-bold text-foreground">{title}</Text>
              {subtitle ? <Text className="text-xs mt-0.5 text-muted-foreground">{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={8} className="w-8 h-8 rounded-full items-center justify-center bg-muted">
              <Ionicons name="close" size={18} color="#9ca3af" />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
