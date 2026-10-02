import { Redirect } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function AppIndex() {
  const { user } = useAuth();

  switch (user?.role) {
    case "contractor":
      return <Redirect href="/contractor" />;
    case "supplier":
      return <Redirect href="/supplier" />;
    case "worker":
      return <Redirect href="/worker" />;
    default:
      return <Redirect href="/homeowner" />;
  }
}
