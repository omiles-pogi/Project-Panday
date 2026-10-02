import { Text, View } from "react-native";
import { Card, MONO, PageHeader, Screen, StatGrid, StatTile } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { DAILY_RATE, DEDUCTIONS, OT_RATE, PAY_HISTORY } from "@/data/worker";

export default function Earnings() {
  const { user } = useAuth();
  const released = PAY_HISTORY.filter((p) => p.status === "released").reduce((s, p) => s + p.net, 0);
  const current = PAY_HISTORY[0];
  const totalDeductions = DEDUCTIONS.reduce((s, d) => s + d.amount, 0);

  return (
    <Screen>
      <PageHeader title="Earnings" subtitle={`${user?.name ?? "Worker"} · Mason · Pay history`} />

      <StatGrid>
        <StatTile label="Daily Rate" value={`₱${DAILY_RATE}`} sub="Regular" />
        <StatTile label="OT Rate /hr" value={`₱${OT_RATE.toLocaleString()}`} color="#f43f5e" sub="x1.25 multiplier" />
        <StatTile label="Total Released" value={`₱${released.toLocaleString()}`} color="#10b981" sub="This project" />
        <StatTile label="Pending Pay" value={`₱${current.net.toLocaleString()}`} color="#f59e0b" sub="Sep 1–15 cutoff" />
      </StatGrid>

      <Card title="Pay History">
        {PAY_HISTORY.map((p, i) => {
          const released = p.status === "released";
          return (
            <View
              key={p.period}
              className="py-3"
              style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: "#1e2235" }}
            >
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-sm font-medium text-foreground">{p.period}</Text>
                <Text className="text-xs font-medium" style={{ color: released ? "#10b981" : "#f59e0b" }}>
                  {released ? "✓ Released" : "Pending"}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted-foreground">
                  {p.days} days{p.ot > 0 ? <Text style={{ color: "#f43f5e" }}> · +{p.ot}h OT</Text> : null}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Gross <Text style={{ fontFamily: MONO, color: "#9ca3af" }}>₱{p.gross.toLocaleString()}</Text> · Net{" "}
                  <Text style={{ fontFamily: MONO, color: "#10b981" }}>₱{p.net.toLocaleString()}</Text>
                </Text>
              </View>
            </View>
          );
        })}
      </Card>

      <Card title="Current Period Deductions">
        <Text className="text-xs mb-3 text-muted-foreground">{current.period}</Text>
        <View style={{ gap: 8 }} className="mb-4">
          {DEDUCTIONS.map(({ label, amount }) => (
            <View key={label} className="flex-row justify-between px-3 py-2 rounded-xl bg-muted">
              <Text className="text-xs text-secondary-foreground">{label}</Text>
              <Text className="text-xs" style={{ color: "#ef4444", fontFamily: MONO }}>
                −₱{amount.toLocaleString()}
              </Text>
            </View>
          ))}
        </View>
        <View className="border-t border-border pt-3" style={{ gap: 8 }}>
          <View className="flex-row justify-between">
            <Text className="text-sm text-secondary-foreground">Total Deductions</Text>
            <Text className="text-sm font-bold" style={{ color: "#ef4444", fontFamily: MONO }}>
              −₱{totalDeductions.toLocaleString()}
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-sm text-secondary-foreground">Gross Pay</Text>
            <Text className="text-sm font-bold text-foreground" style={{ fontFamily: MONO }}>
              ₱{current.gross.toLocaleString()}
            </Text>
          </View>
          <View className="flex-row justify-between pt-2 border-t border-border">
            <Text className="text-base font-bold text-foreground">Net Pay</Text>
            <Text className="text-base font-bold" style={{ color: "#10b981", fontFamily: MONO }}>
              ₱{current.net.toLocaleString()}
            </Text>
          </View>
        </View>
      </Card>
    </Screen>
  );
}
