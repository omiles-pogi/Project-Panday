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
import { fetchContractorProfile, updateMyContractorProfile } from "@/services/api/contractors";

export default function Profile() {
  const { user } = useAuth();
  const form = useProfileEdit({ companyName: "", specialization: "", yearsExperience: "", bio: "", skills: [] as string[] });
  const { companyName, specialization, yearsExperience, bio, skills } = form.draft;
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
    fetchContractorProfile(userId)
      .then((profile) => {
        if (cancelled) return;
        load({ companyName: profile.companyName ?? "", specialization: profile.specialization ?? "",
          yearsExperience: profile.yearsExperience != null ? String(profile.yearsExperience) : "",
          bio: profile.bio ?? "", skills: profile.skills });
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

  const canSave = specialization.trim().length > 0 && yearsExperience.trim().length > 0 && skills.length > 0 && !saving;

  const save = async () => {
    if (!canSave) return;
    await form.save(async () => {
      const confirmed = await updateMyContractorProfile({
        company_name: companyName.trim() || undefined,
        specialization: specialization.trim(),
        years_experience: Number(yearsExperience) || 0,
        bio: bio.trim() || undefined,
        skills,
      });
      return { companyName: confirmed.company_name ?? "", specialization: confirmed.specialization,
        yearsExperience: String(confirmed.years_experience), bio: confirmed.bio ?? "", skills: confirmed.skills.map((s) => s.skill) };
    });
  };

  if (loading) {
    return (
      <Screen>
        <View className="items-center justify-center py-12">
          <ActivityIndicator color="#f59e0b" />
        </View>
      </Screen>
    );
  }

  const name = user?.name ?? "Contractor";

  return (
    <Screen>
      <PageHeader
        title="Company Profile"
        subtitle="This is what homeowners see when searching for contractors to hire."
      />

      <Card>
        <View className="flex-row gap-4 items-center">
          <ProfilePhoto name={name} />
          <View className="flex-1" style={{ gap: 4 }}>
            <Text className="text-lg font-bold text-foreground">{companyName || name}</Text>
            <Text className="text-xs text-secondary-foreground">{specialization || "No specialization set yet"}</Text>
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

      <NameCard requireEdit hint="Your own name. Your company name, if you have one, is set below." />

      <Card title="Profile details" right={<ProfileEditButton editing={editing} disabled={!form.ready} section="profile details" onPress={() => { setSkillInput(""); form.begin(); }} />}>
        <View style={{ gap: 12 }}>
          <ProfileField editing={editing} saving={saving} label="Company name (optional)" value={companyName} onChangeText={(text) => form.change("companyName", text)} placeholder="e.g. RCG Construction" />
          <ProfileField editing={editing} saving={saving}
            label="Specialization"
            value={specialization}
            onChangeText={(text) => form.change("specialization", text)}
            placeholder="e.g. Residential Renovation, Commercial Build"
          />
          <ProfileField editing={editing} saving={saving}
            label="Years of experience"
            value={yearsExperience}
            onChangeText={(t) => form.change("yearsExperience", t.replace(/[^0-9]/g, ""))}
            placeholder="e.g. 10"
            keyboardType="number-pad"
          />
          <ProfileField editing={editing} saving={saving}
            label="Bio (optional)"
            value={bio}
            onChangeText={(text) => form.change("bio", text)}
            placeholder="A short description of your company"
            multiline
          />

          <View>
            <Text className="text-xs font-medium mb-2 text-secondary-foreground">Services / Skills</Text>
            <View className="flex-row flex-wrap gap-2 mb-2">
              {skills.map((skill) => (
                <Pressable
                  key={skill}
                  disabled={!editing || saving}
                  onPress={() => removeSkill(skill)}
                  className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: "#10b98120" }}
                >
                  <Text className="text-xs font-medium" style={{ color: "#10b981" }}>
                    {skill}
                  </Text>
                  {editing && <Ionicons name="close" size={12} color="#10b981" />}
                </Pressable>
              ))}
              {skills.length === 0 && <Text className="text-xs text-muted-foreground">No services added yet</Text>}
            </View>
            {editing && <View className="flex-row gap-2">
              <View className="flex-1">
                <ProfileField editing={editing} saving={saving}
                  label=""
                  value={skillInput}
                  onChangeText={setSkillInput}
                  placeholder="e.g. Project Management"
                  onSubmitEditing={addSkill}
                  returnKeyType="done"
                />
              </View>
              <Pressable disabled={saving} onPress={addSkill} accessibilityLabel="Add service" className="px-4 items-center justify-center rounded-xl bg-primary">
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
