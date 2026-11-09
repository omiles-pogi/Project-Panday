import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Card, Field, PageHeader, Screen, StatGrid, StatTile, SubmitButton } from "@/components/ui";
import NameCard from "@/components/NameCard";
import { useAuth } from "@/context/AuthContext";
import { fetchMyHomeownerProfile, updateMyHomeownerProfile, type HomeownerProfile } from "@/services/api/homeownerProfile";

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<HomeownerProfile | null>(null);
  const [location, setLocation] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const show = useCallback((next: HomeownerProfile) => {
    setProfile(next);
    setLocation(next.location ?? "");
    setContactNumber(next.contactNumber ?? "");
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMyHomeownerProfile()
      .then((next) => {
        if (!cancelled) show(next);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load your profile.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, show]);

  const retry = () => {
    setLoading(true);
    setLoadError(null);
    setAttempt((n) => n + 1);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      show(await updateMyHomeownerProfile({ location: location.trim(), contact_number: contactNumber.trim() }));
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save your profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen topInset={false}>
        <View className="items-center justify-center py-12">
          <ActivityIndicator color="#f59e0b" />
        </View>
      </Screen>
    );
  }

  if (!profile) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <Ionicons name="warning-outline" size={28} color="#ef4444" style={{ marginBottom: 8 }} />
        <Text className="text-sm text-center text-muted-foreground">{loadError}</Text>
        <Pressable onPress={retry} className="mt-4 px-4 py-2 rounded-xl bg-primary">
          <Text className="text-sm font-semibold text-primary-foreground">Retry</Text>
        </Pressable>
      </View>
    );
  }

  // The signed-in name, so a rename shows here at once instead of waiting for this screen to reload.
  const name = user?.name ?? profile.name;
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const accountRows: [string, string][] = [
    ["Name", name],
    ["Email", profile.email],
    ...(profile.memberSince
      ? ([["Member since", new Date(profile.memberSince).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })]] as [string, string][])
      : []),
  ];

  return (
    <Screen topInset={false}>
      <PageHeader title="My Profile" subtitle="Your account details and how people can reach you." />

      <Card>
        <View className="flex-row gap-4 items-center">
          <View className="w-16 h-16 rounded-2xl items-center justify-center" style={{ backgroundColor: "#f59e0b20" }}>
            <Text className="text-2xl font-bold" style={{ color: "#f59e0b" }}>
              {initials}
            </Text>
          </View>
          <View className="flex-1" style={{ gap: 4 }}>
            <Text className="text-lg font-bold text-foreground">{name}</Text>
            <View className="flex-row items-center gap-1">
              <Ionicons name="location-outline" size={13} color="#9ca3af" />
              <Text className="flex-1 text-xs text-secondary-foreground">{profile.location || "No location set yet"}</Text>
            </View>
            <Badge label="Homeowner" color="#3b82f6" />
          </View>
        </View>
      </Card>

      <StatGrid>
        <StatTile label="Projects" value={profile.projects.total} color="#9ca3af" icon="business-outline" />
        <StatTile label="Active" value={profile.projects.active} color="#f59e0b" icon="construct-outline" />
        <StatTile label="Completed" value={profile.projects.completed} color="#10b981" icon="checkmark-circle-outline" />
      </StatGrid>

      <NameCard />

      <Card title="Your details">
        <View style={{ gap: 12 }}>
          <Field label="Location" value={location} onChangeText={setLocation} placeholder="e.g. Dagupan City, Pangasinan" maxLength={255} />
          <Field
            label="Contact number"
            value={contactNumber}
            onChangeText={(text) => setContactNumber(text.replace(/[^0-9+()\-\s]/g, ""))}
            placeholder="e.g. 0912 345 6789"
            keyboardType="phone-pad"
            maxLength={30}
          />
          <Text className="text-xs text-muted-foreground">Only you can see these. Contractors and workers don&apos;t get your location or number.</Text>

          {saveError && <Text className="text-xs text-danger">{saveError}</Text>}
          {saved && <Badge label="Saved" color="#10b981" />}

          <SubmitButton label={saving ? "Saving…" : "Save Profile"} onPress={save} />
        </View>
      </Card>

      <Card title="Account">
        <View className="rounded-xl bg-muted p-3" style={{ gap: 8 }}>
          {accountRows.map(([label, value]) => (
            <View key={label} className="flex-row justify-between gap-3">
              <Text className="text-xs text-muted-foreground">{label}</Text>
              <Text className="flex-1 text-right text-xs font-semibold text-foreground">{value}</Text>
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}
