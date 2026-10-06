import { Stack } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import WaitingApproval from "@/screens/auth/WaitingApproval";

export default function AuthLayout() {
  const { pending } = useAuth();

  // Pandy keeps the user company while an admin reviews the new account.
  if (pending) return <WaitingApproval />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
