// Static sample data mirrored from the web app's worker screens
// (backend/resources/js/components/worker). No worker API exists yet.

export const DAILY_RATE = 850;
export const OT_RATE = 1063; // daily rate / 8 * 1.25 per hour, as shown on the web app

export const TIMESHEET = [
  { date: "Mon, Sep 1", timeIn: "6:58 AM", timeOut: "5:02 PM", hours: 8, ot: 0, status: "verified" },
  { date: "Tue, Sep 2", timeIn: "7:03 AM", timeOut: "5:08 PM", hours: 8, ot: 0, status: "verified" },
  { date: "Wed, Sep 3", timeIn: "6:55 AM", timeOut: "6:10 PM", hours: 9, ot: 1, status: "verified" },
  { date: "Thu, Sep 4", timeIn: "7:01 AM", timeOut: "5:05 PM", hours: 8, ot: 0, status: "verified" },
  { date: "Fri, Sep 5", timeIn: "—", timeOut: "—", hours: 0, ot: 0, status: "absent" },
  { date: "Sat, Sep 6", timeIn: "7:00 AM", timeOut: "11:00 AM", hours: 4, ot: 4, status: "verified" },
  { date: "Sun, Sep 7", timeIn: "—", timeOut: "—", hours: 0, ot: 0, status: "rest" },
];

export const TIMESHEET_STATUS: Record<string, { color: string; label: string }> = {
  verified: { color: "#10b981", label: "Verified" },
  pending: { color: "#f59e0b", label: "Pending" },
  absent: { color: "#ef4444", label: "Absent" },
  rest: { color: "#6b7280", label: "Rest Day" },
};

export const PAY_HISTORY = [
  { period: "Sep 1–15, 2026", days: 10, ot: 5, gross: 9125, net: 7877, status: "pending" },
  { period: "Aug 16–31, 2026", days: 13, ot: 8, gross: 12050, net: 10430, status: "released" },
  { period: "Aug 1–15, 2026", days: 14, ot: 3, gross: 12788, net: 11068, status: "released" },
  { period: "Jul 16–31, 2026", days: 13, ot: 0, gross: 11050, net: 9570, status: "released" },
];

export const DEDUCTIONS = [
  { label: "SSS Contribution", amount: 583 },
  { label: "PhilHealth", amount: 250 },
  { label: "Pag-IBIG", amount: 100 },
  { label: "Withholding Tax", amount: 315 },
];
