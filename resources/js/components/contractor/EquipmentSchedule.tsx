const scheduleData = [
  {
    equipment: "Concrete Mixer A",
    assignments: [
      { week: "Sep 1–7", project: null },
      { week: "Sep 8–14", project: "Garcia Renovation", color: "#ef4444", conflict: true },
      { week: "Sep 15–21", project: "Garcia Renovation", color: "#ef4444" },
      { week: "Sep 22–28", project: null },
      { week: "Oct 1–7", project: null },
      { week: "Oct 8–14", project: null },
    ],
  },
  {
    equipment: "Concrete Mixer B",
    assignments: [
      { week: "Sep 1–7", project: "Dela Cruz Residence", color: "#f59e0b" },
      { week: "Sep 8–14", project: "Dela Cruz Residence", color: "#f59e0b" },
      { week: "Sep 15–21", project: "Dela Cruz Residence", color: "#f59e0b" },
      { week: "Sep 22–28", project: null },
      { week: "Oct 1–7", project: null },
      { week: "Oct 8–14", project: null },
    ],
  },
  {
    equipment: "Scaffolding A",
    assignments: [
      { week: "Sep 1–7", project: "Santos Bldg", color: "#8b5cf6" },
      { week: "Sep 8–14", project: "Santos Bldg", color: "#8b5cf6" },
      { week: "Sep 15–21", project: "Santos Bldg", color: "#8b5cf6" },
      { week: "Sep 22–28", project: "Santos Bldg", color: "#8b5cf6" },
      { week: "Oct 1–7", project: null },
      { week: "Oct 8–14", project: null },
    ],
  },
  {
    equipment: "Scaffolding B",
    assignments: [
      { week: "Sep 1–7", project: null },
      { week: "Sep 8–14", project: null },
      { week: "Sep 15–21", project: "Dela Cruz", color: "#f59e0b" },
      { week: "Sep 22–28", project: "Dela Cruz", color: "#f59e0b" },
      { week: "Oct 1–7", project: "Dela Cruz", color: "#f59e0b" },
      { week: "Oct 8–14", project: null },
    ],
  },
  {
    equipment: "Welding Machine",
    assignments: [
      { week: "Sep 1–7", project: null },
      { week: "Sep 8–14", project: null },
      { week: "Sep 15–21", project: null },
      { week: "Sep 22–28", project: "Santos Bldg", color: "#8b5cf6" },
      { week: "Oct 1–7", project: "Santos Bldg", color: "#8b5cf6" },
      { week: "Oct 8–14", project: null },
    ],
  },
];

export default function EquipmentSchedule() {
  return (
    <div className="scroll-area">
      <div className="px-4 pt-4 pb-24 max-w-full">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-2xl font-700 mb-1" style={{ color: "#f0f2f5" }}>Equipment Schedule</h1>
            <p className="text-sm" style={{ color: "#6b7280" }}>Allocation across all projects</p>
          </div>
          <button className="px-3 py-2 rounded-xl text-sm font-600 flex-shrink-0" style={{ background: "#f59e0b", color: "#0f1117" }}>+ Assign</button>
        </div>

        {/* Conflict alert */}
        <div className="rounded-xl p-4 mb-5 flex items-start gap-3" style={{ background: "#ef444415", border: "1px solid #ef444440" }}>
          <span className="flex-shrink-0">🤖</span>
          <div>
            <div className="font-600 text-sm mb-1" style={{ color: "#ef4444" }}>AI Conflict Detected</div>
            <p className="text-xs leading-relaxed" style={{ color: "#fca5a5" }}>
              <strong>Concrete Mixer A</strong> is double-booked Sep 12–14. AI recommends rescheduling or renting an additional unit.
            </p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <button className="px-3 py-1 rounded text-xs font-500" style={{ background: "#ef444420", color: "#ef4444" }}>Reschedule</button>
              <button className="px-3 py-1 rounded text-xs font-500" style={{ background: "#252a3a", color: "#9ca3af" }}>Accept</button>
            </div>
          </div>
        </div>

        {/* Equipment cards with week timeline */}
        <div className="space-y-3">
          {scheduleData.map(({ equipment, assignments }) => {
            const active = assignments.filter(a => a.project).length;
            return (
              <div key={equipment} className="rounded-xl p-4" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-600 text-sm" style={{ color: "#f0f2f5" }}>{equipment}</span>
                  <span className="text-xs" style={{ color: "#6b7280" }}>{active} of 6 weeks booked</span>
                </div>
                {/* Week grid — 6 cols */}
                <div className="grid grid-cols-6 gap-1">
                  {assignments.map(({ week, project, color, conflict }: any) => (
                    <div key={week} title={week}>
                      {project ? (
                        <div
                          className="rounded py-1.5 text-center"
                          style={{ background: `${color}25`, border: conflict ? `1px solid ${color}` : "none" }}
                        >
                          {conflict && <div className="text-xs text-center" style={{ color }}>⚡</div>}
                          <div className="text-xs font-500 truncate px-0.5" style={{ color, fontSize: 9 }}>{project.split(" ")[0]}</div>
                        </div>
                      ) : (
                        <div className="rounded py-1.5" style={{ background: "#252a3a" }}>
                          <div className="text-center" style={{ color: "#374151", fontSize: 9 }}>Free</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {/* Week labels */}
                <div className="grid grid-cols-6 gap-1 mt-1">
                  {assignments.map(({ week }) => (
                    <div key={week} className="text-center" style={{ color: "#374151", fontSize: 8 }}>{week.split("–")[0]}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 rounded-xl p-3 flex flex-wrap gap-3" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
          {[
            { color: "#f59e0b", label: "Dela Cruz" },
            { color: "#8b5cf6", label: "Santos Bldg" },
            { color: "#ef4444", label: "Garcia Reno" },
            { color: "#3b82f6", label: "Reyes" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ background: `${color}40`, border: `1px solid ${color}` }} />
              <span className="text-xs" style={{ color: "#6b7280" }}>{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="text-xs">⚡</span>
            <span className="text-xs" style={{ color: "#ef4444" }}>Conflict</span>
          </div>
        </div>
      </div>
    </div>
  );
}
