import { useEffect, useState } from "react";
import { Text, View, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Card, Field, PageHeader, Screen, SubmitButton } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { fetchContractorProfile, updateMyContractorProfile } from "@/services/api/contractors";

export default function Profile() {
  const { user } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchContractorProfile(user.id)
      .then((profile) => {
        setCompanyName(profile.companyName ?? "");
        setSpecialization(profile.specialization ?? "");
        setYearsExperience(profile.yearsExperience != null ? String(profile.yearsExperience) : "");
        setBio(profile.bio ?? "");
        setSkills(profile.skills);
        setAverageRating(profile.averageRating);
        setRatingCount(profile.ratingCount);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [user]);

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (!trimmed || skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setSkillInput("");
      return;
    }
    setSkills((prev) => [...prev, trimmed]);
    setSkillInput("");
  };

  const removeSkill = (skill: string) => {
    setSkills((prev) => prev.filter((s) => s !== skill));
  };

  const canSave = specialization.trim().length > 0 && yearsExperience.trim().length > 0 && skills.length > 0 && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateMyContractorProfile({
        company_name: companyName.trim() || undefined,
        specialization: specialization.trim(),
        years_experience: Number(yearsExperience) || 0,
        bio: bio.trim() || undefined,
        skills,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
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
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Screen>
      <PageHeader
        title="Company Profile"
        subtitle="This is what homeowners see when searching for contractors to hire."
      />

      <Card>
        <View className="flex-row gap-4 items-center">
          <View className="w-16 h-16 rounded-2xl items-center justify-center" style={{ backgroundColor: "#10b98120" }}>
            <Text className="text-2xl font-bold" style={{ color: "#10b981" }}>
              {initials}
            </Text>
          </View>
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

      <Card title="Edit profile">
        <View style={{ gap: 12 }}>
          <Field label="Company name (optional)" value={companyName} onChangeText={setCompanyName} placeholder="e.g. RCG Construction" />
          <Field
            label="Specialization"
            value={specialization}
            onChangeText={setSpecialization}
            placeholder="e.g. Residential Renovation, Commercial Build"
          />
          <Field
            label="Years of experience"
            value={yearsExperience}
            onChangeText={(t) => setYearsExperience(t.replace(/[^0-9]/g, ""))}
            placeholder="e.g. 10"
            keyboardType="number-pad"
          />
          <Field
            label="Bio (optional)"
            value={bio}
            onChangeText={setBio}
            placeholder="A short description of your company"
            multiline
          />

          <View>
            <Text className="text-xs font-medium mb-2 text-secondary-foreground">Services / Skills</Text>
            <View className="flex-row flex-wrap gap-2 mb-2">
              {skills.map((skill) => (
                <Pressable
                  key={skill}
                  onPress={() => removeSkill(skill)}
                  className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: "#10b98120" }}
                >
                  <Text className="text-xs font-medium" style={{ color: "#10b981" }}>
                    {skill}
                  </Text>
                  <Ionicons name="close" size={12} color="#10b981" />
                </Pressable>
              ))}
              {skills.length === 0 && <Text className="text-xs text-muted-foreground">No services added yet</Text>}
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Field
                  label=""
                  value={skillInput}
                  onChangeText={setSkillInput}
                  placeholder="e.g. Project Management"
                  onSubmitEditing={addSkill}
                  returnKeyType="done"
                />
              </View>
              <Pressable onPress={addSkill} className="px-4 items-center justify-center rounded-xl bg-primary">
                <Ionicons name="add" size={18} color="#0f1117" />
              </Pressable>
            </View>
          </View>

          {error && <Text className="text-xs text-danger">{error}</Text>}
          {saved && <Badge label="Saved" color="#10b981" />}

          <SubmitButton label={saving ? "Saving…" : "Save Profile"} onPress={save} />
        </View>
      </Card>
    </Screen>
  );
}
