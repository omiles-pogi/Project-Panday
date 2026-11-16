import { Text } from "react-native";
import { Card } from "@/components/ui";
import type { ProjectEarnings as Earnings } from "@/services/api/workerActivity";
import type { Wage } from "@/types/project";
import { peso } from "@/utils/currency";

export default function ProjectEarnings({ earnings, wage: assignmentWage, error }: { earnings: Earnings | null; wage?: Wage | null; error: string | null }) {
  const wage = earnings ? earnings.wage : assignmentWage;
  return <Card title="Earnings" gap={10}>
    <Text className="text-xs text-muted-foreground">Your wage details for this project.</Text>
    {error && <Text accessibilityRole="alert" className="text-xs text-danger">{error}</Text>}
    {wage?.unit === "per_day" && <Text className="text-sm text-foreground">{wage.auto ? "Estimated daily rate" : "Recorded daily wage"}: {peso(wage.amount)} / day</Text>}
    {earnings && <>
      <Text className="text-sm text-foreground">Recorded attendance days: {earnings.daysWorked}</Text>
      <Text className="text-sm text-foreground">Recorded checked-out hours: {earnings.hoursWorked}</Text>
      {earnings.earned != null && <Text className="text-base font-bold text-foreground">{wage?.auto ? "Estimated earnings from attendance" : "Recorded earnings from attendance"}: {peso(earnings.earned)}</Text>}
    </>}
    {wage ? wage.unit === "fixed" || wage.days != null
      ? <Text className="text-sm text-foreground">{wage.auto ? "Estimated project wage" : wage.unit === "fixed" ? "Agreed project fee" : "Projected project wage"}: {peso(wage.total)}</Text>
      : <Text className="text-sm text-muted-foreground">Project wage estimate unavailable: planned workdays are not recorded.</Text>
      : <Text className="text-sm text-muted-foreground">No wage has been recorded for this assignment.</Text>}
    {earnings?.earned == null && <Text className="text-xs text-muted-foreground">Actual daily earnings are unavailable without a recorded daily rate.</Text>}
    <Text className="text-xs text-muted-foreground">Attendance-based amounts and project estimates do not confirm that payment has been made.</Text>
  </Card>;
}
