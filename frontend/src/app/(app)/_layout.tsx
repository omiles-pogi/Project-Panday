import { Stack } from "expo-router";
import { TourProvider } from "@/context/TourContext";

export default function AppLayout() {
  return (
    <TourProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </TourProvider>
  );
}
