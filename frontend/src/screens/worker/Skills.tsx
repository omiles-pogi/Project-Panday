import { Text, View } from "react-native";
import { Badge, Card, MONO, PageHeader, ProgressBar, Screen, StatGrid, StatTile } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { CERTIFICATIONS, LEVEL_COLOR, SKILLS } from "@/data/worker";

export default function Skills() {
  const { user } = useAuth();
  const name = user?.name ?? "Worker";
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Screen>
      <PageHeader title="Skills & Profile" />

      <Card>
        <View className="flex-row gap-4 items-center">
          <View className="w-16 h-16 rounded-2xl items-center justify-center" style={{ backgroundColor: "#f43f5e20" }}>
            <Text className="text-2xl font-bold" style={{ color: "#f43f5e" }}>
              {initials}
            </Text>
          </View>
          <View className="flex-1" style={{ gap: 4 }}>
            <Text className="text-lg font-bold text-foreground">{name}</Text>
            <Text className="text-xs text-secondary-foreground">Skilled Mason · 8 years experience</Text>
            <View className="flex-row flex-wrap gap-1.5">
              <Badge label="✓ Verified" color="#10b981" />
              <Badge label="⭐ 4.8" color="#f59e0b" />
            </View>
          </View>
        </View>
      </Card>

      <StatGrid>
        <StatTile label="Projects Done" value="9" />
        <StatTile label="Total Hours" value="1,136h" color="#f59e0b" />
        <StatTile label="On-time Rate" value="94%" color="#10b981" />
        <StatTile label="Quality Score" value="4.8/5" color="#3b82f6" />
      </StatGrid>

      <Card title="Skills Assessment" right={<Text className="text-xs text-muted-foreground">AI-assessed</Text>}>
        <View style={{ gap: 16 }}>
          {SKILLS.map(({ name: skill, level, years, pct }) => {
            const color = LEVEL_COLOR[level];
            return (
              <View key={skill}>
                <View className="flex-row items-center justify-between mb-1.5">
                  <Text className="flex-1 text-sm font-medium text-foreground pr-2">{skill}</Text>
                  <Text className="text-xs text-muted-foreground" style={{ fontFamily: MONO }}>
                    {years}y · {pct}%
                  </Text>
                </View>
                <View className="mb-1.5">
                  <ProgressBar pct={pct} color={color} />
                </View>
                <Badge label={level} color={color} />
              </View>
            );
          })}
        </View>
        <View className="mt-4 p-3 rounded-xl" style={{ backgroundColor: "#f59e0b15", borderLeftWidth: 3, borderLeftColor: "#f59e0b" }}>
          <Text className="text-xs leading-5" style={{ color: "#fbbf24" }}>
            🤖 AI Suggestion: Based on your masonry expertise, you qualify for senior mason roles. Improving your
            tile-setting skills could increase your daily rate by up to ₱150.
          </Text>
        </View>
      </Card>

      <Card title="Certifications & Training">
        <View style={{ gap: 10 }}>
          {CERTIFICATIONS.map(({ name: cert, issuer, year }) => (
            <View key={cert} className="flex-row items-center justify-between px-4 py-3 rounded-xl bg-muted">
              <View className="flex-1 pr-2">
                <Text className="font-medium text-sm text-foreground">{cert}</Text>
                <Text className="text-xs text-muted-foreground">
                  {issuer} · {year}
                </Text>
              </View>
              <Badge label="✓ Valid" color="#10b981" />
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}
