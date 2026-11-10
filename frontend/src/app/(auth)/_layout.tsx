import { Stack } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import WaitingApproval from "@/screens/auth/WaitingApproval";
import { PasswordRecoveryProvider } from "@/context/PasswordRecoveryContext";

export default function AuthLayout() {
  const { pending } = useAuth();

  // PandAi keeps the user company while an admin reviews the new account.
  if (pending) return <WaitingApproval />;

  return (
    <PasswordRecoveryProvider>
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />
    </PasswordRecoveryProvider>
  );
}
