import { useEffect, useState } from "react";
import { Text, View, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Card, PageHeader, Screen } from "@/components/ui";
import { ProfileEditActions, ProfileEditButton, ProfileField } from "@/components/ProfileEditControls";
import { useProfileEdit } from "@/hooks/useProfileEdit";
import NameCard from "@/components/NameCard";
import ProfilePhoto from "@/components/ProfilePhoto";
import AccountManagement from "@/components/AccountManagement";
import { useAuth } from "@/context/AuthContext";
import { fetchWorkerProfile, updateMyWorkerProfile } from "@/services/api/workers";

export default function Skills() {
  const { user } = useAuth();
  const form = useProfileEdit({ trade: "", yearsExperience: "", bio: "", minDailyWage: "", skills: [] as string[] });
  const { trade, yearsExperience, bio, minDailyWage, skills } = form.draft;
  const { editing, saving, saved, error, load } = form;
  const [skillInput, setSkillInput] = useState("");
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchWorkerProfile(userId)
      .then((profile) => {
        if (cancelled) return;
        load({ trade: profile.trade ?? "", yearsExperience: profile.yearsExperience != null ? String(profile.yearsExperience) : "",
          bio: profile.bio ?? "", minDailyWage: profile.minDailyWage != null ? String(profile.minDailyWage) : "", skills: profile.skills });
        setAverageRating(profile.averageRating);
        setRatingCount(profile.ratingCount);
      })
      .catch((err) => { if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load profile."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, load]);

  const addSkill = () => {
    if (!editing || saving) return;
    const trimmed = skillInput.trim();
    if (!trimmed || skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setSkillInput("");
      return;
    }
    form.change("skills", [...skills, trimmed]);
    setSkillInput("");
  };

  const removeSkill = (skill: string) => {
    form.change("skills", skills.filter((s) => s !== skill));
  };

  const canSave = trade.trim().length > 0 && yearsExperience.trim().length > 0 && skills.length > 0 && !saving;

  const save = async () => {
    if (!canSave) return;
    await form.save(async () => {
      const confirmed = await updateMyWorkerProfile({
        trade: trade.trim(),
        years_experience: Number(yearsExperience) || 0,
        bio: bio.trim() || undefined,
        // Blank clears it, so a worker can take the rate back down.
        min_daily_wage: minDailyWage.trim() ? Number(minDailyWage) : null,
        skills,
      });
      return { trade: confirmed.trade, yearsExperience: String(confirmed.years_experience), bio: confirmed.bio ?? "",
        minDailyWage: confirmed.min_daily_wage != null ? String(confirmed.min_daily_wage) : "", skills: confirmed.skills.map((s) => s.skill) };
    });
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

  const name = user?.name ?? "Worker";

  return (
    <Screen topInset={false}>
      <PageHeader
        title="Skills & Profile"
        subtitle="This is what homeowners and contractors see when searching for workers."
      />

      <Card>
        <View className="flex-row gap-4 items-center">
          <ProfilePhoto name={name} />
          <View className="flex-1" style={{ gap: 4 }}>
            <Text className="text-lg font-bold text-foreground">{name}</Text>
            <Text className="text-xs text-secondary-foreground">{trade || "No trade set yet"}</Text>
            {ratingCount > 0 ? (
              <View className="flex-row items-center gap-1">
                <Ionicons name="star" size={12} color="#f59e0b" />
                <Text className="text-xs" style={{ color: "#f59e0b" }}>
                  {averageRating} ({ratingCount} {ratingCount === 1 ? "rating" : "ratings"})
                </Text>
              </View>
            ) : (
              <Text className="text-xs text-muted-foreground">No ratings yet</Text>
            )}
          </View>
        </View>
      </Card>

      <NameCard requireEdit />

      <Card title="Profile details" right={<ProfileEditButton editing={editing} disabled={!form.ready} section="profile details" onPress={() => { setSkillInput(""); form.begin(); }} />}>
        <View style={{ gap: 12 }}>
          <ProfileField editing={editing} saving={saving} label="Trade" value={trade} onChangeText={(text) => form.change("trade", text)} placeholder="e.g. Mason, Electrician, Carpenter" />
          <ProfileField editing={editing} saving={saving}
            label="Years of experience"
            value={yearsExperience}
            onChangeText={(t) => form.change("yearsExperience", t.replace(/[^0-9]/g, ""))}
            placeholder="e.g. 5"
            keyboardType="number-pad"
          />
          <ProfileField editing={editing} saving={saving}
            label="Minimum daily wage (₱, optional)"
            value={minDailyWage}
            onChangeText={(t) => form.change("minDailyWage", t.replace(/[^0-9]/g, ""))}
            placeholder="e.g. 850 — the lowest day rate you'll take"
            keyboardType="number-pad"
          />
          <Text className="text-xs -mt-1 text-muted-foreground">
            Homeowners and contractors see this when they look for a worker. Other workers don&apos;t.
          </Text>
          <ProfileField editing={editing} saving={saving}
            label="Bio (optional)"
            value={bio}
            onChangeText={(text) => form.change("bio", text)}
            placeholder="A short description of your experience"
            multiline
          />

          <View>
            <Text className="text-xs font-medium mb-2 text-secondary-foreground">Skills</Text>
            <View className="flex-row flex-wrap gap-2 mb-2">
              {skills.map((skill) => (
                <Pressable
                  key={skill}
                  disabled={!editing || saving}
                  onPress={() => removeSkill(skill)}
                  className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: "#f59e0b20" }}
                >
                  <Text className="text-xs font-medium" style={{ color: "#f59e0b" }}>
                    {skill}
                  </Text>
                  {editing && <Ionicons name="close" size={12} color="#f59e0b" />}
                </Pressable>
              ))}
              {skills.length === 0 && <Text className="text-xs text-muted-foreground">No skills added yet</Text>}
            </View>
            {editing && <View className="flex-row gap-2">
              <View className="flex-1">
                <ProfileField editing={editing} saving={saving}
                  label=""
                  value={skillInput}
                  onChangeText={setSkillInput}
                  placeholder="e.g. Concrete Work"
                  onSubmitEditing={addSkill}
                  returnKeyType="done"
                />
              </View>
              <Pressable disabled={saving} onPress={addSkill} accessibilityLabel="Add skill" className="px-4 items-center justify-center rounded-xl bg-primary">
                <Ionicons name="add" size={18} color="#0f1117" />
              </Pressable>
            </View>}
          </View>

          {error && <Text className="text-xs text-danger">{error}</Text>}
          {loadError && <Text className="text-xs text-danger">{loadError}</Text>}
          {saved && <Badge label="Saved" color="#10b981" />}

          {editing && <ProfileEditActions saving={saving} canSave={canSave} onSave={save} onCancel={() => { form.cancel(); setSkillInput(""); }} />}
        </View>
      </Card>
      <AccountManagement accountInformation />
    </Screen>
  );
}
