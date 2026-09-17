const monthDays = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1;
  const dow = (2 + i) % 7; // Sep 2026 starts on Tuesday
  const isWeekend = dow === 0 || dow === 6;
  const isPast = day <= 7;
  const status = !isPast ? "future" : isWeekend ? "rest" : day === 5 ? "absent" : "present";
  return { day, dow, status };
});

const statusStyle: Record<string, { color: string; bg: string; label: string }> = {
  present: { color: "#10b981", bg: "#10b98130", label: "Present" },
  absent: { color: "#ef4444", bg: "#ef444430", label: "Absent" },
  rest: { color: "#374151", bg: "#25253a", label: "Rest" },
  future: { color: "#374151", bg: "#1a1d27", label: "" },
};

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function WorkerAttendance() {
  const present = monthDays.filter(d => d.status === "present").length;
  const absent = monthDays.filter(d => d.status === "absent").length;
  const rate = Math.round((present / (present + absent)) * 100);

  return (
    <div className="scroll-area">
      <div className="px-4 pt-4 pb-24 max-w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-700 mb-1" style={{ color: "#f0f2f5" }}>Attendance</h1>
          <p className="text-sm" style={{ color: "#6b7280" }}>Marco Aquino · September 2026 · Dela Cruz Residence</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { label: "Days Present", value: present, color: "#10b981" },
            { label: "Days Absent", value: absent, color: "#ef4444" },
            { label: "Rest Days", value: monthDays.filter(d => d.status === "rest").length, color: "#6b7280" },
            { label: "Attendance Rate", value: `${rate}%`, color: "#f59e0b" },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-4 rounded-xl text-center" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
              <div className="text-xs mb-1" style={{ color: "#6b7280" }}>{label}</div>
              <div className="text-2xl font-700 mono" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Calendar */}
        <div className="rounded-xl p-5 mb-6" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <h2 className="font-600 text-sm mb-4" style={{ color: "#f0f2f5" }}>September 2026</h2>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {days.map(d => (
              <div key={d} className="text-center text-xs font-600 py-1" style={{ color: "#6b7280" }}>{d}</div>
            ))}
          </div>
          {/* Calendar grid — Sep 1 = Tuesday (col 2) */}
          <div className="grid grid-cols-7 gap-1">
            {/* Offset for Tuesday start */}
            {[0, 1].map(i => <div key={`empty-${i}`} />)}
            {monthDays.map(({ day, status }) => {
              const s = statusStyle[status];
              return (
                <div
                  key={day}
                  className="aspect-square rounded-lg flex items-center justify-center text-sm font-600 transition-all"
                  style={{ background: s.bg, color: s.color }}
                  title={s.label}
                >
                  {day}
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex gap-5 mt-4">
            {Object.entries({ present: "Present", absent: "Absent", rest: "Rest Day", future: "Upcoming" }).map(([key, label]) => {
              const s = statusStyle[key];
              return (
                <div key={key} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded" style={{ background: s.bg, border: key === "future" ? "1px solid #2a2f42" : "none" }} />
                  <span className="text-xs" style={{ color: "#6b7280" }}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI insight */}
        <div className="rounded-xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          <h2 className="font-600 text-sm mb-3" style={{ color: "#f0f2f5" }}>🤖 AI Attendance Insight</h2>
          <div className="space-y-3">
            <p className="text-sm leading-relaxed" style={{ color: "#9ca3af" }}>
              Your current attendance rate of <strong style={{ color: "#f59e0b" }}>{rate}%</strong> is above the project average of 89%. Your 1 absence this month was on a Friday — consistent Friday absences may affect your project score over time.
            </p>
            <div className="px-3 py-2 rounded-lg text-sm" style={{ background: "#10b98115", borderLeft: "3px solid #10b981" }}>
              <span style={{ color: "#10b981" }}>✓ Contractor Rating Impact:</span> <span style={{ color: "#6ee7b7" }}>High attendance rate increases your priority for future project assignments.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
