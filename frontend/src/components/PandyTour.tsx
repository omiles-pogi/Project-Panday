import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Mascot from "@/components/Mascot";
import { TOURS } from "@/data/tours";
import type { Role } from "@/types/auth";

// Pandy's step-by-step welcome tour, shown as a bottom sheet over the app.
export default function PandyTour({
  role,
  visible,
  onClose,
}: {
  role: Role;
  visible: boolean;
  onClose: () => void;
}) {
  const steps = TOURS[role];
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const last = index === steps.length - 1;

  const close = () => {
    setIndex(0);
    onClose();
  };

  if (!step) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.65)" }}>
        <View className="items-center" style={{ marginBottom: -34, zIndex: 1 }}>
          <Mascot size={96} bob mood={index === 0 ? "happy" : "thinking"} />
        </View>
        <View className="bg-card border border-border rounded-t-3xl px-6 pb-8 pt-12 items-center">
          <View className="w-11 h-11 rounded-full items-center justify-center mb-3" style={{ backgroundColor: "#f59e0b20" }}>
            <Ionicons name={step.icon} size={22} color="#f59e0b" />
          </View>
          <Text className="text-lg font-extrabold text-foreground text-center">{step.title}</Text>
          <Text className="text-sm text-muted-foreground text-center mt-2 leading-relaxed" style={{ maxWidth: 420 }}>
            {step.text}
          </Text>

          <View className="flex-row gap-1.5 mt-5">
            {steps.map((_, i) => (
              <View
                key={i}
                className="h-1.5 rounded-full"
                style={{ width: i === index ? 18 : 6, backgroundColor: i === index ? "#f59e0b" : "#2a2f42" }}
              />
            ))}
          </View>

          <View className="flex-row items-center gap-3 mt-6 w-full" style={{ maxWidth: 420 }}>
            {index > 0 ? (
              <Pressable onPress={() => setIndex(index - 1)} className="px-5 py-3 rounded-xl bg-secondary border border-border">
                <Text className="text-sm font-semibold text-muted-foreground">Back</Text>
              </Pressable>
            ) : (
              <Pressable onPress={close} className="px-5 py-3">
                <Text className="text-sm font-semibold text-muted-foreground">Skip</Text>
              </Pressable>
            )}
            <Pressable
              onPress={last ? close : () => setIndex(index + 1)}
              className="flex-1 py-3 rounded-xl items-center bg-primary"
            >
              <Text className="text-sm font-bold text-primary-foreground">{last ? "Let's go!" : "Next"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
