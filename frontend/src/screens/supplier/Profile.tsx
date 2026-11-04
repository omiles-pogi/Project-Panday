import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Card, Field, PageHeader, Screen, StatGrid, StatTile, SubmitButton } from "@/components/ui";
import { fetchMySupplierProfile, updateMySupplierProfile, type SupplierProfile } from "@/services/api/supplierProfile";

const STATUS_BADGE: Record<SupplierProfile["approvalStatus"], { label: string; color: string }> = {
  approved: { label: "Approved supplier", color: "#10b981" },
  pending: { label: "Awaiting approval", color: "#f59e0b" },
  rejected: { label: "Not approved", color: "#ef4444" },
};

export default function Profile() {
  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [location, setLocation] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const show = useCallback((next: SupplierProfile) => {
    setProfile(next);
    setLocation(next.location ?? "");
    setContactNumber(next.contactNumber ?? "");
    setBio(next.bio ?? "");
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMySupplierProfile()
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
      show(await updateMySupplierProfile({ location: location.trim(), contact_number: contactNumber.trim(), bio: bio.trim() }));
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

  const shopName = profile.businessName || profile.name;
  const initials = shopName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const status = STATUS_BADGE[profile.approvalStatus];
  const accountRows: [string, string][] = [
    ["Contact person", profile.name],
    ["Email", profile.email],
    ...(profile.licenseNumber ? ([["License / ID no.", profile.licenseNumber]] as [string, string][]) : []),
    ...(profile.memberSince
      ? ([["Member since", new Date(profile.memberSince).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })]] as [string, string][])
      : []),
  ];

  return (
    <Screen topInset={false}>
      <PageHeader title="Shop Profile" subtitle="This is what homeowners and contractors see when they open your listings." />

      <Card>
        <View className="flex-row gap-4 items-center">
          <View className="w-16 h-16 rounded-2xl items-center justify-center" style={{ backgroundColor: "#f59e0b20" }}>
            <Text className="text-2xl font-bold" style={{ color: "#f59e0b" }}>
              {initials}
            </Text>
          </View>
          <View className="flex-1" style={{ gap: 4 }}>
            <Text className="text-lg font-bold text-foreground">{shopName}</Text>
            <View className="flex-row items-center gap-1">
              <Ionicons name="location-outline" size={13} color="#9ca3af" />
              <Text className="flex-1 text-xs text-secondary-foreground">{profile.location || "No location set yet"}</Text>
            </View>
            <Badge label={status.label} color={status.color} />
          </View>
        </View>
      </Card>

      <StatGrid>
        <StatTile label="Listings" value={profile.listings.total} color="#9ca3af" icon="layers-outline" />
        <StatTile label="Visible to Buyers" value={profile.listings.active} color="#3b82f6" icon="eye-outline" />
        <StatTile label="In Stock" value={profile.listings.inStock} color="#10b981" icon="checkmark-circle-outline" />
      </StatGrid>

      <Card title="Shop details">
        <View style={{ gap: 12 }}>
          <Field label="Location" value={location} onChangeText={setLocation} placeholder="e.g. San Fabian, Pangasinan" maxLength={255} />
          <Field
            label="Contact number"
            value={contactNumber}
            onChangeText={(text) => setContactNumber(text.replace(/[^0-9+()\-\s]/g, ""))}
            placeholder="e.g. 0912 345 6789"
            keyboardType="phone-pad"
            maxLength={30}
          />
          <Field
            label="About your shop"
            value={bio}
            onChangeText={setBio}
            placeholder="What you sell, delivery areas, opening hours…"
            multiline
            maxLength={1000}
          />
          <Text className="text-xs text-muted-foreground">Your location and contact number are shown to homeowners and contractors on your listings.</Text>

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
        <Text className="text-xs mt-3 text-muted-foreground">
          Your business name and license were checked when your account was approved, so they can&apos;t be changed here.
        </Text>
      </Card>
    </Screen>
  );
}
