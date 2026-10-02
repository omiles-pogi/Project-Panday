import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Badge, Button, Card, ChipPicker, MONO, PageHeader, Screen } from "@/components/ui";
import { AVAILABLE_PROJECTS } from "@/data/contractor";

const TYPES = ["All", "Residential", "Commercial"];

export default function AvailableProjects() {
  const [type, setType] = useState("All");
  const [declined, setDeclined] = useState<string[]>([]);

  const visible = AVAILABLE_PROJECTS.filter(
    (p) => !declined.includes(p.name) && (type === "All" || p.type === type),
  );

  return (
    <Screen>
      <PageHeader title="Available Projects" subtitle="Homeowner-approved projects open for contractor bids" />
      <ChipPicker label="Type" options={TYPES} value={type} onChange={setType} />

      {visible.length === 0 ? (
        <Text className="text-sm text-center text-muted-foreground mt-6">No projects match.</Text>
      ) : null}

      {visible.map((p) => (
        <Card key={p.name}>
          <View className="flex-row items-start justify-between mb-3">
            <View className="flex-1 pr-3">
              <Text className="font-bold text-base text-foreground mb-1">{p.name}</Text>
              {p.ai ? <Badge label="🤖 AI-Approved Plan" color="#f59e0b" /> : null}
              <Text className="text-xs mt-2 mb-1 text-muted-foreground">
                {p.location} · {p.type}
              </Text>
              <Text className="text-sm text-secondary-foreground">{p.description}</Text>
            </View>
            <View className="items-end">
              <Text className="text-base font-bold" style={{ color: "#f59e0b", fontFamily: MONO }}>
                {p.budget}
              </Text>
              <Text className="text-xs text-muted-foreground">Approved Budget</Text>
            </View>
          </View>

          <View className="flex-row flex-wrap gap-2 mb-3">
            {[
              { label: "Start Date", value: p.start },
              { label: "Target", value: p.target },
              { label: "Duration", value: p.duration },
            ].map(({ label, value }) => (
              <View key={label} className="p-3 rounded-xl bg-muted" style={{ width: "31%" }}>
                <Text className="text-xs mb-1 text-muted-foreground">{label}</Text>
                <Text className="text-xs font-medium text-foreground">{value}</Text>
              </View>
            ))}
          </View>

          <View className="p-3 rounded-xl bg-muted mb-3">
            <Text className="text-xs mb-1 text-muted-foreground">Required Workforce</Text>
            <Text className="text-xs text-secondary-foreground">{p.workers}</Text>
          </View>

          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button label="Accept Project" onPress={() => router.push("/contractor/capacity-monitor" as never)} />
            </View>
            <Button
              label="Decline"
              variant="tint"
              color="#ef4444"
              onPress={() => setDeclined((d) => [...d, p.name])}
            />
          </View>
        </Card>
      ))}
    </Screen>
  );
}
