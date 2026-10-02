interface SidebarProps {
  role: "homeowner" | "contractor" | "supplier" | "worker";
  activeSection: string;
  onNav: (section: string) => void;
  onLogout: () => void;
}

const homeownerNav = [
  { id: "dashboard", label: "Dashboard", icon: "⊞" },
  { id: "create-project", label: "AI Project Planner", icon: "🤖" },
  { id: "budget", label: "Budget Generator", icon: "₱" },
  { id: "materials", label: "Material Estimator", icon: "🧱" },
  { id: "labor", label: "Labor Estimator", icon: "👷" },
  { id: "equipment", label: "Equipment", icon: "🚧" },
  { id: "design", label: "AI Design", icon: "📐" },
  { id: "approvals", label: "Approval Center", icon: "✓" },
  { id: "marketplace", label: "Contractors", icon: "🏢" },
  { id: "progress", label: "Progress Monitor", icon: "📊" },
  { id: "budget-monitor", label: "Budget Monitor", icon: "💰" },
  { id: "expenses", label: "Expenses", icon: "🧾" },
];

const contractorNav = [
  { id: "contractor-dashboard", label: "Dashboard", icon: "⊞" },
  { id: "available-projects", label: "Available Projects", icon: "📋" },
  { id: "capacity-monitor", label: "Capacity Monitor", icon: "⚡" },
  { id: "equipment-schedule", label: "Equipment Schedule", icon: "📅" },
  { id: "project-management", label: "My Projects", icon: "🏗️" },
  { id: "progress-report", label: "Progress Report", icon: "📝" },
  { id: "progress-analysis", label: "Progress Analysis", icon: "📈" },
  { id: "weekly-analytics", label: "Weekly Analytics", icon: "📉" },
];

const supplierNav = [
  { id: "supplier-dashboard", label: "Dashboard", icon: "⊞" },
  { id: "materials-catalog", label: "Materials Catalog", icon: "🧱" },
  { id: "bid-requests", label: "Bid Requests", icon: "📋" },
  { id: "orders", label: "Orders", icon: "📦" },
  { id: "pricing", label: "Pricing", icon: "₱" },
];

const workerNav = [
  { id: "worker-dashboard", label: "Dashboard", icon: "⊞" },
  { id: "worker-assignments", label: "My Assignments", icon: "📋" },
  { id: "worker-timesheet", label: "Timesheet", icon: "🕐" },
  { id: "worker-daily-log", label: "Daily Work Log", icon: "📝" },
  { id: "worker-earnings", label: "Earnings", icon: "₱" },
  { id: "worker-skills", label: "Skills & Profile", icon: "🔧" },
  { id: "worker-attendance", label: "Attendance", icon: "✓" },
];

const roleLabels = {
  homeowner: { label: "Homeowner", color: "#3b82f6", initials: "JD" },
  contractor: { label: "Contractor", color: "#10b981", initials: "RC" },
  supplier: { label: "Supplier", color: "#8b5cf6", initials: "SM" },
  worker: { label: "Skilled Worker", color: "#f43f5e", initials: "MA" },
};

export default function Sidebar({ role, activeSection, onNav, onLogout }: SidebarProps) {
  const navItems = role === "homeowner" ? homeownerNav : role === "contractor" ? contractorNav : role === "worker" ? workerNav : supplierNav;
  const { label, color, initials } = roleLabels[role];

  return (
    <aside className="flex flex-col w-60 min-h-screen flex-shrink-0" style={{ background: "#1a1d27", borderRight: "1px solid #2a2f42" }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: "#2a2f42" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#f59e0b" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="#0f1117" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div>
          <div className="text-sm font-700" style={{ color: "#f0f2f5" }}>Project-Panday</div>
          <div className="text-xs" style={{ color: "#6b7280" }}>v2.0 Platform</div>
        </div>
      </div>

      {/* Role badge */}
      <div className="px-4 py-3 border-b" style={{ borderColor: "#2a2f42" }}>
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: "#252a3a" }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-700 flex-shrink-0" style={{ background: color, color: "#fff" }}>{initials}</div>
          <div className="min-w-0">
            <div className="text-xs font-600 truncate" style={{ color: "#f0f2f5" }}>{role === "homeowner" ? "Juan Dela Cruz" : role === "contractor" ? "RCG Construction" : role === "worker" ? "Marco Aquino" : "Steel & More Co."}</div>
            <div className="text-xs" style={{ color: color }}>{label}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-0.5">
        {navItems.map(({ id, label, icon }) => {
          const active = activeSection === id;
          return (
            <button
              key={id}
              onClick={() => onNav(id)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all text-sm"
              style={{
                background: active ? "#f59e0b15" : "transparent",
                color: active ? "#f59e0b" : "#9ca3af",
                borderLeft: active ? "2px solid #f59e0b" : "2px solid transparent",
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#f0f2f5"; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#9ca3af"; }}
            >
              <span className="text-base w-5 text-center">{icon}</span>
              <span className="font-500 truncate">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t" style={{ borderColor: "#2a2f42" }}>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all"
          style={{ color: "#6b7280" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#ef4444"; (e.currentTarget as HTMLElement).style.background = "#ef444410"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#6b7280"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <span>⟵</span>
          <span className="font-500">Logout</span>
        </button>
      </div>
    </aside>
  );
}
