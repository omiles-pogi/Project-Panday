import { useState } from "react";

const timesheetData = [
  { date: "Mon, Sep 1", timeIn: "6:58 AM", timeOut: "5:02 PM", hours: 8, ot: 0, status: "verified" },
  { date: "Tue, Sep 2", timeIn: "7:03 AM", timeOut: "5:08 PM", hours: 8, ot: 0, status: "verified" },
  { date: "Wed, Sep 3", timeIn: "6:55 AM", timeOut: "6:10 PM", hours: 9, ot: 1, status: "verified" },
  { date: "Thu, Sep 4", timeIn: "7:01 AM", timeOut: "5:05 PM", hours: 8, ot: 0, status: "verified" },
  { date: "Fri, Sep 5", timeIn: "—", timeOut: "—", hours: 0, ot: 0, status: "absent" },
  { date: "Sat, Sep 6", timeIn: "7:00 AM", timeOut: "11:00 AM", hours: 4, ot: 4, status: "verified" },
  { date: "Sun, Sep 7", timeIn: "—", timeOut: "—", hours: 0, ot: 0, status: "rest" },
];

const statusStyle: Record<string, { color: string; bg: string; label: string }> = {
  verified: { color: "#10b981", bg: "#10b98120", label: "Verified" },
  pending: { color: "#f59e0b", bg: "#f59e0b20", label: "Pending" },
  absent: { color: "#ef4444", bg: "#ef444420", label: "Absent" },
  rest: { color: "#6b7280", bg: "#25253a", label: "Rest Day" },
};

export default function WorkerTimesheet() {
  const [month] = useState("September 2026");
  const dailyRate = 850;
  const totalHours = timesheetData.reduce((s, d) => s + d.hours, 0);
  const totalOT = timesheetData.reduce((s, d) => s + d.ot, 0);
  const regularDays = timesheetData.filter(d => d.hours >= 8).length;
  const regularPay = regularDays * dailyRate;
  const otPay = Math.round(totalOT * (dailyRate / 8) * 1.25);
  const totalPay = regularPay + otPay;

  return (
    <div className="scroll-area">
      <div className="px-4 pt-4 pb-24 max-w-full">
        <div className="mb-5">
          <h1 className="text-2xl font-700 mb-0.5" style={{ color: "#f0f2f5" }}>Timesheet</h1>
          <p className="text-sm" style={{ color: "#6b7280" }}>Marco Aquino · Dela Cruz Residence</p>
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between mb-4 p-3 rounded-xl" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <button className="px-3 py-1.5 rounded-lg text-sm" style={{ background: "#252a3a", color: "#9ca3af" }}>← Aug</button>
          <span className="text-sm font-600" style={{ color: "#f59e0b" }}>{month}</span>
          <button className="px-3 py-1.5 rounded-lg text-sm" style={{ background: "#252a3a", color: "#9ca3af" }}>Oct →</button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: "Total Hours", value: `${totalHours}h`, color: "#f59e0b" },
            { label: "Regular Days", value: regularDays, color: "#f0f2f5" },
            { label: "Overtime Hours", value: `${totalOT}h`, color: "#f43f5e" },
            { label: "Est. Week Pay", value: `₱${totalPay.toLocaleString()}`, color: "#10b981" },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-4 rounded-xl text-center" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
              <div className="text-xs mb-1" style={{ color: "#6b7280" }}>{label}</div>
              <div className="text-xl font-700 mono" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Daily log cards */}
        <div className="rounded-xl overflow-hidden mb-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "#2a2f42" }}>
            <h2 className="font-600 text-sm" style={{ color: "#f0f2f5" }}>Daily Attendance Log</h2>
            <span className="text-xs" style={{ color: "#6b7280" }}>Verified by Foreman</span>
          </div>
          <div className="divide-y" style={{ borderColor: "#1e2235" }}>
            {timesheetData.map((d, i) => {
              const s = statusStyle[d.status];
              const dayPay = d.hours >= 8 ? dailyRate + Math.round(d.ot * (dailyRate / 8) * 1.25) : 0;
              return (
                <div key={i} className="px-4 py-3" style={{ borderBottom: i < timesheetData.length - 1 ? "1px solid #1e2235" : "none" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-500" style={{ color: "#f0f2f5" }}>{d.date}</span>
                    <span className="px-2 py-0.5 rounded text-xs font-500" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                  </div>
                  <div className="flex justify-between text-xs" style={{ color: "#6b7280" }}>
                    <span>
                      {d.timeIn !== "—"
                        ? <><span style={{ color: "#10b981" }}>{d.timeIn}</span> – <span style={{ color: "#f59e0b" }}>{d.timeOut}</span></>
                        : "—"}
                    </span>
                    <div className="flex gap-3">
                      {d.hours > 0 && <span className="mono font-500" style={{ color: "#f0f2f5" }}>{d.hours}h{d.ot > 0 ? <span style={{ color: "#f43f5e" }}> +{d.ot}OT</span> : ""}</span>}
                      {dayPay > 0 && <span className="mono font-600" style={{ color: "#10b981" }}>₱{dayPay.toLocaleString()}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: "#2a2f42" }}>
            <div className="text-xs space-y-0.5">
              <div style={{ color: "#6b7280" }}>Regular: <span className="mono font-600" style={{ color: "#f0f2f5" }}>₱{regularPay.toLocaleString()}</span></div>
              <div style={{ color: "#6b7280" }}>Overtime: <span className="mono font-600" style={{ color: "#f43f5e" }}>₱{otPay.toLocaleString()}</span></div>
            </div>
            <div className="font-700 mono text-base" style={{ color: "#10b981" }}>₱{totalPay.toLocaleString()}</div>
          </div>
        </div>

        <div className="rounded-xl px-4 py-3" style={{ background: "#f59e0b15", border: "1px solid #f59e0b30" }}>
          <p className="text-xs leading-relaxed" style={{ color: "#fbbf24" }}>
            <strong>ℹ Payroll Note:</strong> Final pay is subject to SSS, PhilHealth, and Pag-IBIG deductions as required by law.
          </p>
        </div>
      </div>
    </div>
  );
}
