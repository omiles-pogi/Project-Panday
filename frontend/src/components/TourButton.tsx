import { Pressable, Text, View } from "react-native";
import Mascot from "@/components/Mascot";
import { useTour } from "@/context/TourContext";

// "Take a tour with Pandy" row for the More screens.
export default function TourButton() {
  const { openTour } = useTour();
  return (
    <Pressable
      onPress={openTour}
      className="flex-row items-center gap-3 mt-4 px-4 py-3 rounded-2xl bg-card border border-border"
    >
      <Mascot size={36} />
      <View className="flex-1">
        <Text className="text-sm font-semibold text-foreground">Take a tour with Pandy</Text>
        <Text className="text-xs text-muted-foreground">A quick guide to how everything works</Text>
      </View>
    </Pressable>
  );
}
