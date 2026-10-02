interface WorkerDashboardProps { onNav: (s: string) => void }

const todayTasks = [
  { task: "Form removal — 2nd floor columns", status: "in-progress", priority: "high" },
  { task: "Masonry — east wall block laying", status: "pending", priority: "normal" },
  { task: "Cleanup — construction debris", status: "pending", priority: "low" },
];

const weekHours = [
  { day: "Mon", hours: 8, ot: false },
  { day: "Tue", hours: 8, ot: false },
  { day: "Wed", hours: 9, ot: true },
  { day: "Thu", hours: 8, ot: false },
  { day: "Fri", hours: 0, ot: false },
  { day: "Sat", hours: 4, ot: true },
  { day: "Sun", hours: 0, ot: false },
];

const taskStatus: Record<string, { color: string; label: string; icon: string }> = {
  "in-progress": { color: "#3b82f6", label: "In Progress", icon: "▶" },
  pending: { color: "#6b7280", label: "Pending", icon: "○" },
  done: { color: "#10b981", label: "Done", icon: "✓" },
};
const priorityColor: Record<string, string> = { high: "#ef4444", normal: "#f59e0b", low: "#6b7280" };

export default function WorkerDashboard({ onNav }: WorkerDashboardProps) {
  const totalHours = weekHours.reduce((s, d) => s + d.hours, 0);
  const weekPay = weekHours.reduce((s, d) => s + d.hours * (d.ot ? 1063 : 850), 0);

  return (
    <div className="scroll-area">
      <div className="px-4 pt-4 pb-24 space-y-4">

        {/* Greeting card */}
        <div className="rounded-3xl p-5" style={{ background: "linear-gradient(135deg, #1a1d27, #252a3a)", border: "1px solid #2a2f42" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs mb-0.5" style={{ color: "#6b7280" }}>Good morning 👋</p>
              <h2 className="text-xl font-800" style={{ color: "#f0f2f5" }}>Marco Aquino</h2>
              <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>Mason · Dela Cruz Residence</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-800 mono" style={{ color: "#10b981" }}>₱{weekPay.toLocaleString()}</div>
              <div className="text-xs" style={{ color: "#6b7280" }}>Est. week pay</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Hours This Week", value: `${totalHours}h`, color: "#3b82f6" },
              { label: "Attendance", value: "94%", color: "#10b981" },
              { label: "Daily Rate", value: "₱850", color: "#f59e0b" },
            ].map(({ label, value, color }) => (
              <div key={label} className="px-3 py-2.5 rounded-2xl text-center" style={{ background: "#0f111788" }}>
                <div className="font-700 text-sm mono mb-0.5" style={{ color }}>{value}</div>
                <div className="text-xs" style={{ color: "#6b7280" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Log Work", icon: "📝", id: "worker-daily-log" },
            { label: "Timesheet", icon: "🕐", id: "worker-timesheet" },
            { label: "Earnings", icon: "₱", id: "worker-earnings" },
            { label: "Profile", icon: "🔧", id: "worker-skills" },
          ].map(({ label, icon, id }) => (
            <button key={id} onClick={() => onNav(id)} className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl active:scale-[0.95]" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
              <span className="text-2xl">{icon}</span>
              <span className="text-xs font-600" style={{ color: "#9ca3af" }}>{label}</span>
            </button>
          ))}
        </div>

        {/* Today's tasks */}
        <div className="rounded-3xl p-4" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-700 text-sm" style={{ color: "#f0f2f5" }}>Today's Tasks</h3>
            <button onClick={() => onNav("worker-assignments")} className="text-xs font-600" style={{ color: "#f59e0b" }}>All →</button>
          </div>
          <div className="space-y-2.5">
            {todayTasks.map((t, i) => {
              const ts = taskStatus[t.status];
              return (
                <div key={i} className="flex items-center gap-3 p-3.5 rounded-2xl" style={{ background: "#252a3a" }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-600" style={{ background: ts.color + "20", color: ts.color }}>{ts.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-500 leading-snug" style={{ color: "#f0f2f5" }}>{t.task}</div>
                  </div>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: priorityColor[t.priority] }} />
                </div>
              );
            })}
          </div>
          <button onClick={() => onNav("worker-daily-log")} className="w-full mt-3 py-3 rounded-2xl text-sm font-700 transition-all active:scale-[0.98]" style={{ background: "#f59e0b", color: "#0f1117" }}>
            + Log Today's Work
          </button>
        </div>

        {/* Weekly hours */}
        <div className="rounded-3xl p-4" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <h3 className="font-700 text-sm mb-4" style={{ color: "#f0f2f5" }}>This Week's Hours</h3>
          <div className="flex items-end gap-2" style={{ height: 80 }}>
            {weekHours.map(({ day, hours, ot }) => (
              <div key={day} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center" style={{ height: 56 }}>
                  <div className="w-full rounded-t-lg" style={{ height: hours > 0 ? `${(hours / 9) * 100}%` : 4, background: hours === 0 ? "#252a3a" : ot ? "#f43f5e" : "#f59e0b", minHeight: hours > 0 ? 8 : 4 }} />
                </div>
                <span className="text-xs" style={{ color: "#6b7280" }}>{day}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded" style={{ background: "#f59e0b" }} /><span className="text-xs" style={{ color: "#6b7280" }}>Regular</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded" style={{ background: "#f43f5e" }} /><span className="text-xs" style={{ color: "#6b7280" }}>Overtime</span></div>
          </div>
        </div>

        {/* AI insights */}
        <div className="space-y-2.5">
          {[
            { color: "#f59e0b", icon: "🤖", title: "Performance", msg: "Your masonry output (62 blocks/day) is 8% above team average." },
            { color: "#3b82f6", icon: "📅", title: "Schedule", msg: "Roofing phase begins Oct 1 — your assignment shifts to scaffold setup Sep 28." },
            { color: "#10b981", icon: "₱", title: "Pay Reminder", msg: "Payroll cutoff is Sep 15. Log all hours by Sep 14." },
          ].map(({ color, icon, title, msg }) => (
            <div key={title} className="flex gap-3 p-4 rounded-3xl" style={{ background: color + "12", border: `1px solid ${color}25` }}>
              <span className="text-lg flex-shrink-0">{icon}</span>
              <div>
                <div className="text-xs font-700 mb-0.5" style={{ color }}>{title}</div>
                <p className="text-xs leading-relaxed" style={{ color: "#9ca3af" }}>{msg}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
