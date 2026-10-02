import { Text, View } from "react-native";
import { Card, InfoBox, MONO, PageHeader, Screen, StatGrid, StatTile } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { DAILY_RATE, TIMESHEET, TIMESHEET_STATUS } from "@/data/worker";

export default function Timesheet() {
  const { user } = useAuth();
  const totalHours = TIMESHEET.reduce((s, d) => s + d.hours, 0);
  const totalOT = TIMESHEET.reduce((s, d) => s + d.ot, 0);
  const regularDays = TIMESHEET.filter((d) => d.hours >= 8).length;
  const regularPay = regularDays * DAILY_RATE;
  const otPay = Math.round(totalOT * (DAILY_RATE / 8) * 1.25);
  const totalPay = regularPay + otPay;

  return (
    <Screen>
      <PageHeader title="Timesheet" subtitle={`${user?.name ?? "Worker"} · Dela Cruz Residence · Sep 1–7, 2026`} />

      <StatGrid>
        <StatTile label="Total Hours" value={`${totalHours}h`} color="#f59e0b" />
        <StatTile label="Regular Days" value={regularDays} />
        <StatTile label="Overtime Hours" value={`${totalOT}h`} color="#f43f5e" />
        <StatTile label="Est. Week Pay" value={`₱${totalPay.toLocaleString()}`} color="#10b981" />
      </StatGrid>

      <Card title="Daily Attendance Log" right={<Text className="text-xs text-muted-foreground">Verified by Foreman</Text>}>
        {TIMESHEET.map((d, i) => {
          const s = TIMESHEET_STATUS[d.status];
          const dayPay = d.hours >= 8 ? DAILY_RATE + Math.round(d.ot * (DAILY_RATE / 8) * 1.25) : 0;
          return (
            <View
              key={d.date}
              className="py-3"
              style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: "#1e2235" }}
            >
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-sm font-medium text-foreground">{d.date}</Text>
                <Text className="text-xs font-medium" style={{ color: s.color }}>
                  {s.label}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted-foreground">
                  {d.timeIn !== "—" ? (
                    <>
                      <Text style={{ color: "#10b981" }}>{d.timeIn}</Text> –{" "}
                      <Text style={{ color: "#f59e0b" }}>{d.timeOut}</Text>
                    </>
                  ) : (
                    "—"
                  )}
                </Text>
                <Text className="text-xs" style={{ fontFamily: MONO, color: "#f0f2f5" }}>
                  {d.hours > 0 ? `${d.hours}h` : ""}
                  {d.ot > 0 ? <Text style={{ color: "#f43f5e" }}> +{d.ot}OT</Text> : null}
                  {dayPay > 0 ? <Text style={{ color: "#10b981" }}>  ₱{dayPay.toLocaleString()}</Text> : null}
                </Text>
              </View>
            </View>
          );
        })}
        <View className="flex-row items-center justify-between pt-3 border-t border-border">
          <View>
            <Text className="text-xs text-muted-foreground">Regular: ₱{regularPay.toLocaleString()}</Text>
            <Text className="text-xs" style={{ color: "#f43f5e" }}>
              Overtime: ₱{otPay.toLocaleString()}
            </Text>
          </View>
          <Text className="font-bold text-base" style={{ color: "#10b981", fontFamily: MONO }}>
            ₱{totalPay.toLocaleString()}
          </Text>
        </View>
      </Card>

      <InfoBox color="#f59e0b">
        <Text className="text-xs leading-5" style={{ color: "#fbbf24" }}>
          ℹ Payroll Note: Final pay is subject to SSS, PhilHealth, and Pag-IBIG deductions as required by law.
        </Text>
      </InfoBox>
    </Screen>
  );
}
