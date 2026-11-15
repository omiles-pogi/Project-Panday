import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/ui";
import { RecoveryField } from "@/components/auth/PasswordRecoveryUI";
import PasswordRequirements, { PasswordConfirmation } from "@/components/auth/PasswordValidation";
import { isValidPassword } from "@/validators/auth";
import { useAuth } from "@/context/AuthContext";
import { useAccount } from "@/context/AccountContext";
import { useTheme } from "@/context/ThemeContext";
import { useNotifications } from "@/context/NotificationContext";
import { changeAccountPassword, type NotificationPreferences } from "@/services/api/account";

function SettingSwitch({ title, description, value, disabled, onChange }: { title: string; description: string; value: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  const { chrome } = useTheme();
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text style={{ color: chrome.foreground, fontWeight: "700" }}>{title}</Text><Text style={{ color: chrome.secondaryForeground, fontSize: 12, lineHeight: 18 }}>{description}</Text></View>
    <Switch accessibilityLabel={title} value={value} disabled={disabled} onValueChange={onChange} trackColor={{ true: "#f59e0b", false: chrome.border }} />
  </View>;
}

export default function AccountManagement({ accountInformation = false }: { accountInformation?: boolean }) {
  const { user } = useAuth();
  const account = useAccount();
  const { mode, setTheme, chrome } = useTheme();
  const { pushStatus, refreshPushPermissions } = useNotifications();
  const preferences = account.data?.preferences;
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const clearPassword = () => { setCurrent(""); setPassword(""); setConfirmation(""); setAttempted(false); setPasswordError(null); };
  const submit = async () => {
    setAttempted(true);
    if (lock.current || !current || !isValidPassword(password) || password !== confirmation) return;
    lock.current = true; setSaving(true); setPasswordError(null); setSuccess(null);
    try {
      const response = await changeAccountPassword({ current_password: current, password, password_confirmation: confirmation });
      if (alive.current) { clearPassword(); setPasswordOpen(false); setSuccess(response.message); }
    } catch (err) { if (alive.current) setPasswordError(err instanceof Error ? err.message : "Could not update your password."); }
    finally { lock.current = false; if (alive.current) setSaving(false); }
  };
  const preference = (key: keyof NotificationPreferences, value: boolean) => void account.updatePreferences({ [key]: value });
  const role = user?.role === "worker" ? "Skilled Worker" : user?.role ? user.role[0].toUpperCase() + user.role.slice(1) : "";
  return <>
    {accountInformation && <Card title="Account Information">
      {[["Full name", user?.name], ["Registered email", user?.email], ["Role", role], ["Verified business name", user?.business_name], ["Verified license / ID", user?.license_number]].filter(([, value]) => value).map(([label, value]) =>
        <View key={label} style={{ paddingVertical: 6, gap: 3 }}><Text style={{ color: chrome.secondaryForeground, fontSize: 12 }}>{label}</Text><Text selectable style={{ color: chrome.foreground }}>{value}</Text></View>)}
    </Card>}
    <Card title="Security">
      <Pressable accessibilityRole="button" accessibilityLabel="Change Password" disabled={saving} onPress={() => { clearPassword(); setSuccess(null); setPasswordOpen(!passwordOpen); }} style={{ flexDirection: "row", gap: 10, alignItems: "center", minHeight: 44 }}>
        <Ionicons name="lock-closed-outline" size={19} color="#f59e0b" /><Text style={{ color: chrome.foreground, fontWeight: "700" }}>Change Password</Text>
      </Pressable>
      {passwordOpen && <View style={{ gap: 14, marginTop: 12 }}>
        <RecoveryField label="Current Password" value={current} onChangeText={setCurrent} secureTextEntry existingPassword autoComplete="current-password" editable={!saving} />
        {attempted && !current && <Text accessibilityRole="alert" style={{ color: "#ef4444" }}>Enter your current password.</Text>}
        <View><RecoveryField label="New Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" editable={!saving} /><PasswordRequirements password={password} attempted={attempted} /></View>
        <View><RecoveryField label="Confirm New Password" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" editable={!saving} /><PasswordConfirmation password={password} confirmation={confirmation} attempted={attempted} /></View>
        {passwordError && <Text accessibilityRole="alert" style={{ color: "#ef4444" }}>{passwordError}</Text>}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => { clearPassword(); setPasswordOpen(false); }} style={{ flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: chrome.muted, borderRadius: 12 }}><Text style={{ color: chrome.foreground }}>Cancel</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => void submit()} style={{ flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: "#f59e0b", borderRadius: 12 }}><Text style={{ color: "#111", fontWeight: "700" }}>{saving ? "Updating…" : "Update Password"}</Text></Pressable>
        </View>
      </View>}
      {success && <Text accessibilityLiveRegion="polite" style={{ color: mode === "dark" ? "#4ade80" : "#15803d", marginTop: 8 }}>{success}</Text>}
    </Card>
    <Card title="App Settings">
      <Text style={{ color: chrome.secondaryForeground, fontSize: 12, fontWeight: "700" }}>APPEARANCE</Text>
      <SettingSwitch title="Dark Mode" description="Use the same appearance as the header theme toggle." value={mode === "dark"} disabled={false} onChange={dark => setTheme(dark ? "dark" : "light")} />
      <Text style={{ color: chrome.secondaryForeground, fontSize: 12, fontWeight: "700", marginTop: 12 }}>NOTIFICATIONS</Text>
      {account.loading && !account.ready && <ActivityIndicator accessibilityLabel="Loading notification preferences" color="#f59e0b" />}
      {account.error && <View style={{ gap: 8 }}><Text accessibilityRole="alert" style={{ color: "#ef4444", fontSize: 12 }}>{account.error}</Text><Pressable accessibilityRole="button" disabled={account.loading || account.saving} onPress={() => void account.refresh()} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: "#f59e0b" }}>Retry account settings</Text></Pressable></View>}
      <SettingSwitch title="Push Notifications" description="Allow remote alerts on supported devices. Android permission is managed separately." value={preferences?.push_enabled ?? false} disabled={!account.ready || account.saving} onChange={value => preference("push_enabled", value)} />
      <SettingSwitch title="Project Updates" description="Remote alerts for projects, team activity and material workflows." value={preferences?.project_updates ?? false} disabled={!account.ready || account.saving || !preferences?.push_enabled} onChange={value => preference("project_updates", value)} />
      <SettingSwitch title="Messages" description="Remote alerts for new chat messages. Your in-app conversations remain available." value={preferences?.messages ?? false} disabled={!account.ready || account.saving || !preferences?.push_enabled} onChange={value => preference("messages", value)} />
      <Text accessibilityLiveRegion="polite" style={{ color: chrome.secondaryForeground, fontSize: 12, lineHeight: 18 }}>{pushStatus || "Remote push requires a configured development or production build. In-app notifications remain available."}</Text>
      {preferences?.push_enabled && <Pressable accessibilityRole="button" onPress={refreshPushPermissions} disabled={account.saving} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: "#f59e0b" }}>Check push permissions</Text></Pressable>}
      {!preferences?.push_enabled && account.ready && <Text style={{ color: chrome.secondaryForeground, fontSize: 12 }}>Category choices are saved while Push Notifications is off.</Text>}
    </Card>
    <Card title="Other">
      {["About Project Panday", "Privacy Policy", "Terms and Conditions"].map(label => <View key={label} accessibilityLabel={`${label}, Coming Soon`} style={{ paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={{ flex: 1, color: chrome.secondaryForeground }}>{label}</Text><Text style={{ color: chrome.mutedForeground, fontSize: 11 }}>Coming Soon</Text>
      </View>)}
    </Card>
  </>;
}
