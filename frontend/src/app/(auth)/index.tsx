import { useAuth } from "@/context/AuthContext";
import Welcome from "@/screens/auth/Welcome";
import Login from "@/screens/auth/Login";

// Fresh sign-ins land on Welcome; someone just approved (prefillEmail set) skips straight to the
// sign-in form instead of making them tap through the landing page again.
export default function AuthIndex() {
  const { prefillEmail } = useAuth();
  return prefillEmail ? <Login /> : <Welcome />;
}
