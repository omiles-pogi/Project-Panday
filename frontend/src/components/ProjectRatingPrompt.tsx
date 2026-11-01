import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Sheet from "@/components/Sheet";
import { Field } from "@/components/ui";
import { useTheme } from "@/context/ThemeContext";
import { fetchProjectRatings, rateProjectTeamMember } from "@/services/api/projects";
import type { ProjectRatingStatus, TeamRatingMember } from "@/types/project";

// Projects whose rating sheet already opened by itself this session — it nudges once, then the
// card on the dashboard is the way back in, so closing the sheet doesn't get nagged open again.
const autoPrompted = new Set<number>();

function Stars({ score, onChange, size = 26 }: { score: number; onChange?: (n: number) => void; size?: number }) {
  return (
    <View className="flex-row gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange?.(n)} disabled={!onChange} hitSlop={4} accessibilityLabel={`${n} star${n === 1 ? "" : "s"}`}>
          <Ionicons name={n <= score ? "star" : "star-outline"} size={size} color="#f59e0b" />
        </Pressable>
      ))}
    </View>
  );
}

function MemberRow({
  member,
  onSubmit,
}: {
  member: TeamRatingMember;
  onSubmit: (userId: number, score: number, comment?: string) => Promise<void>;
}) {
  const { chrome } = useTheme();
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(member.userId, score, comment.trim() || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit the rating. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="rounded-2xl p-4 bg-muted border border-border" style={{ gap: 12 }}>
      <View className="flex-row items-center gap-3">
        <Ionicons
          name={member.role === "contractor" ? "business-outline" : "hammer-outline"}
          size={18}
          color={member.role === "contractor" ? "#10b981" : "#f59e0b"}
        />
        <View className="flex-1">
          <Text className="text-sm font-semibold text-foreground">{member.name}</Text>
          <Text className="text-xs text-muted-foreground">{member.subtitle}</Text>
        </View>
        {member.rated && (
          <View className="flex-row items-center gap-1">
            <Ionicons name="checkmark-circle" size={14} color="#10b981" />
            <Text className="text-xs font-semibold" style={{ color: "#10b981" }}>
              Rated
            </Text>
          </View>
        )}
      </View>

      {member.rated ? (
        <View style={{ gap: 6 }}>
          <Stars score={member.score ?? 0} size={20} />
          {member.comment ? <Text className="text-xs text-muted-foreground">“{member.comment}”</Text> : null}
        </View>
      ) : (
        <>
          <Stars score={score} onChange={setScore} />
          <Field label="" value={comment} onChangeText={setComment} placeholder="Optional comment" />
          {error && <Text className="text-xs text-danger">{error}</Text>}
          <Pressable
            onPress={submit}
            disabled={score === 0 || submitting}
            className="py-2.5 rounded-xl items-center"
            style={{ backgroundColor: score === 0 ? chrome.muted : "#f59e0b", opacity: submitting ? 0.6 : 1, borderWidth: 1, borderColor: chrome.border }}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#0f1117" />
            ) : (
              <Text className="text-xs font-bold" style={{ color: score === 0 ? chrome.mutedForeground : "#0f1117" }}>
                {score === 0 ? "Tap the stars to rate" : "Submit rating"}
              </Text>
            )}
          </Pressable>
        </>
      )}
    </View>
  );
}

/**
 * Shown on the homeowner dashboard once a project reaches 100%: a card inviting them to rate the
 * contractor and workers who built it, and the sheet to do it in. Opens by itself the first time
 * a finished project with unrated people is viewed. Renders nothing for an unfinished project or a
 * project without a team. Mount with key={projectId} so state resets when switching projects.
 */
export default function ProjectRatingPrompt({ projectId, progressPct }: { projectId: number; progressPct: number }) {
  const [status, setStatus] = useState<ProjectRatingStatus | null>(null);
  const [open, setOpen] = useState(false);
  const complete = progressPct >= 100;

  useEffect(() => {
    if (!complete) return;
    let cancelled = false;
    fetchProjectRatings(projectId)
      .then((s) => {
        if (cancelled) return;
        setStatus(s);
        if (s.canRate && s.pendingCount > 0 && !autoPrompted.has(projectId)) {
          autoPrompted.add(projectId);
          setOpen(true);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [projectId, complete]);

  const submit = async (userId: number, score: number, comment?: string) => {
    setStatus(await rateProjectTeamMember(projectId, userId, score, comment));
  };

  if (!complete || !status || !status.canRate || status.team.length === 0) return null;

  const allRated = status.pendingCount === 0;

  return (
    <>
      <View
        className="rounded-3xl p-4"
        style={{ backgroundColor: allRated ? "#10b98112" : "#f59e0b14", borderWidth: 1, borderColor: allRated ? "#10b98140" : "#f59e0b50" }}
      >
        <View className="flex-row items-center gap-3">
          <Ionicons name={allRated ? "checkmark-done-circle" : "star"} size={26} color={allRated ? "#10b981" : "#f59e0b"} />
          <View className="flex-1">
            <Text className="font-bold text-sm text-foreground">
              {allRated ? "Thanks for rating your team" : "Project complete — rate your team"}
            </Text>
            <Text className="text-xs mt-0.5 text-muted-foreground">
              {allRated
                ? "Your ratings help other homeowners pick the right people."
                : `${status.pendingCount} of ${status.team.length} still waiting for your rating.`}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => setOpen(true)}
          className="mt-3 py-2.5 rounded-xl items-center"
          style={{ backgroundColor: allRated ? "#10b98120" : "#f59e0b" }}
        >
          <Text className="text-xs font-bold" style={{ color: allRated ? "#10b981" : "#0f1117" }}>
            {allRated ? "View ratings" : "Rate now"}
          </Text>
        </Pressable>
      </View>

      <Sheet
        visible={open}
        title="Rate your team"
        subtitle="How did they do on this project? Each person can be rated once."
        onClose={() => setOpen(false)}
      >
        {status.team.map((m) => (
          <MemberRow key={`${m.role}-${m.userId}`} member={m} onSubmit={submit} />
        ))}
      </Sheet>
    </>
  );
}
