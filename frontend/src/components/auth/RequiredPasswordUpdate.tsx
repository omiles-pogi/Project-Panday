import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { changeAccountPassword } from "@/services/api/account";
import { isValidPassword } from "@/validators/auth";
import PasswordRequirements, { PasswordConfirmation } from "@/components/auth/PasswordValidation";
import { RecoveryButton, RecoveryError, RecoveryField, RecoveryScreen } from "@/components/auth/PasswordRecoveryUI";

/** Exact legacy credentials remain usable, but the limited session cannot enter the app. */
export default function RequiredPasswordUpdate() {
  const { user, login, logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const valid = !!current && isValidPassword(password) && confirmation === password;
  const submit = async () => {
    if (lock.current || !user || (!saved && !valid)) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      if (!saved) {
        await changeAccountPassword({ current_password: current, password, password_confirmation: confirmation });
        setSaved(true); // If the following sign-in fails, retry it without changing the password again.
      }
      await login(user.email, password);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not finish the password update. Please retry or sign in again."); }
    finally { lock.current = false; setBusy(false); }
  };
  return <RecoveryScreen title="Update your password" description="Your existing password was verified. Replace it with one without whitespace to continue. Your account and saved data are preserved.">
    {!saved ? <View style={{ gap: 14 }}>
      <RecoveryField label="Current Password" value={current} onChangeText={setCurrent} secureTextEntry allowLegacyWhitespace autoComplete="current-password" editable={!busy} />
      <View><RecoveryField label="New Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" editable={!busy} /><PasswordRequirements password={password} /></View>
      <View><RecoveryField label="Confirm New Password" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" editable={!busy} /><PasswordConfirmation password={password} confirmation={confirmation} /></View>
    </View> : <Text className="text-foreground">Password updated. Continue signing in with your new password.</Text>}
    <RecoveryError message={error} />
    <RecoveryButton label={saved ? "Continue signing in" : "Update Password"} disabled={busy || (!saved && !valid)} busy={busy} onPress={() => void submit()} />
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void logout()} style={{ minHeight: 44, justifyContent: "center" }}><Text className="text-primary text-center">Sign out</Text></Pressable>
  </RecoveryScreen>;
}
