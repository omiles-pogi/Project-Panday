import { useState } from "react";

type Role = "homeowner" | "contractor" | "supplier" | "worker";

interface NavItem { id: string; label: string; icon: string }

const homeownerTabs: NavItem[] = [
  { id: "dashboard", label: "Home", icon: "⊞" },
  { id: "create-project", label: "AI Plan", icon: "🤖" },
  { id: "progress", label: "Progress", icon: "📊" },
  { id: "budget-monitor", label: "Budget", icon: "₱" },
  { id: "more-homeowner", label: "More", icon: "⋯" },
];

const contractorTabs: NavItem[] = [
  { id: "contractor-dashboard", label: "Home", icon: "⊞" },
  { id: "available-projects", label: "Projects", icon: "📋" },
  { id: "project-management", label: "My Work", icon: "🏗️" },
  { id: "progress-report", label: "Report", icon: "📝" },
  { id: "more-contractor", label: "More", icon: "⋯" },
];

const supplierTabs: NavItem[] = [
  { id: "supplier-dashboard", label: "Home", icon: "⊞" },
  { id: "supplier-bids", label: "Bids", icon: "📋" },
  { id: "supplier-orders", label: "Orders", icon: "📦" },
  { id: "supplier-pricing", label: "Pricing", icon: "₱" },
];

const workerTabs: NavItem[] = [
  { id: "worker-dashboard", label: "Home", icon: "⊞" },
  { id: "worker-assignments", label: "Tasks", icon: "📋" },
  { id: "worker-daily-log", label: "Log", icon: "📝" },
  { id: "worker-earnings", label: "Pay", icon: "₱" },
  { id: "more-worker", label: "More", icon: "⋯" },
];

const homeownerMore: NavItem[] = [
  { id: "budget", label: "Budget Generator", icon: "₱" },
  { id: "materials", label: "Materials", icon: "🧱" },
  { id: "labor", label: "Labor", icon: "👷" },
  { id: "equipment", label: "Equipment", icon: "🚧" },
  { id: "design", label: "AI Design", icon: "📐" },
  { id: "approvals", label: "Approvals", icon: "✓" },
  { id: "marketplace", label: "Contractors", icon: "🏢" },
  { id: "expenses", label: "Expenses", icon: "🧾" },
];

const contractorMore: NavItem[] = [
  { id: "capacity-monitor", label: "Capacity", icon: "⚡" },
  { id: "equipment-schedule", label: "Equipment", icon: "📅" },
  { id: "progress-analysis", label: "Analysis", icon: "📈" },
  { id: "weekly-analytics", label: "Analytics", icon: "📉" },
];

const workerMore: NavItem[] = [
  { id: "worker-timesheet", label: "Timesheet", icon: "🕐" },
  { id: "worker-skills", label: "Skills", icon: "🔧" },
  { id: "worker-attendance", label: "Attendance", icon: "✓" },
];

const roleConfig = {
  homeowner: { label: "Homeowner", color: "#3b82f6", initials: "JD", name: "Juan Dela Cruz", tabs: homeownerTabs, more: homeownerMore },
  contractor: { label: "Contractor", color: "#10b981", initials: "RC", name: "RCG Construction", tabs: contractorTabs, more: contractorMore },
  supplier: { label: "Supplier", color: "#8b5cf6", initials: "SM", name: "Steel & More Co.", tabs: supplierTabs, more: [] },
  worker: { label: "Skilled Worker", color: "#f43f5e", initials: "MA", name: "Marco Aquino", tabs: workerTabs, more: workerMore },
};

const sectionTitles: Record<string, string> = {
  dashboard: "Dashboard", "create-project": "AI Planner", "ai-planner": "AI Planner",
  budget: "Budget Generator", materials: "Materials", labor: "Labor", equipment: "Equipment",
  design: "AI Design", approvals: "Approvals", marketplace: "Contractors", progress: "Progress",
  "budget-monitor": "Budget Monitor", expenses: "Expenses",
  "contractor-dashboard": "Dashboard", "available-projects": "Projects",
  "capacity-monitor": "Capacity Monitor", "equipment-schedule": "Equipment",
  "project-management": "My Projects", "progress-report": "Progress Report",
  "progress-analysis": "AI Analysis", "weekly-analytics": "Analytics",
  "supplier-dashboard": "Dashboard", "materials-catalog": "Materials",
  "supplier-bids": "Bid Requests", "supplier-orders": "Orders", "supplier-pricing": "Pricing",
  "bid-requests": "Bid Requests", orders: "Orders", pricing: "Pricing",
  "worker-dashboard": "Dashboard", "worker-assignments": "Assignments",
  "worker-timesheet": "Timesheet", "worker-daily-log": "Work Log",
  "worker-earnings": "Earnings", "worker-skills": "Skills & Profile", "worker-attendance": "Attendance",
};

interface MobileLayoutProps {
  role: Role;
  section: string;
  onNav: (s: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export default function MobileLayout({ role, section, onNav, onLogout, children }: MobileLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const cfg = roleConfig[role];
  const tabs = cfg.tabs;
  const title = sectionTitles[section] || "BuildAI";
  const isMoreSection = (cfg.more as NavItem[]).some(m => m.id === section);
  const activeTab = isMoreSection ? tabs[tabs.length - 1].id : (tabs.find(t => t.id === section)?.id ?? tabs[0].id);

  const handleTabPress = (id: string) => {
    if (id.startsWith("more-")) { setMoreOpen(true); }
    else { onNav(id); setMoreOpen(false); }
  };

  const handleMoreNav = (id: string) => { onNav(id); setMoreOpen(false); };

  return (
    <div className="flex flex-col h-full relative" style={{ background: "#0f1117", maxWidth: 480, margin: "0 auto" }}>
      {/* Top header */}
      <header className="flex items-center gap-3 px-4 flex-shrink-0" style={{ height: 56, background: "#1a1d27", borderBottom: "1px solid #2a2f42" }}>
        <button onClick={() => setDrawerOpen(true)} className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#252a3a" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 12h18M3 6h18M3 18h18" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
        <h1 className="flex-1 font-700 text-base truncate" style={{ color: "#f0f2f5" }}>{title}</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#252a3a" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
            <div className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: "#ef4444" }} />
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-700" style={{ background: cfg.color + "30", color: cfg.color }}>{cfg.initials}</div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-hidden" style={{ paddingBottom: 0 }}>
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="flex-shrink-0" style={{ background: "#1a1d27", borderTop: "1px solid #2a2f42", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex">
          {tabs.map(tab => {
            const active = tab.id === activeTab || (tab.id.startsWith("more-") && isMoreSection);
            return (
              <button
                key={tab.id}
                onClick={() => handleTabPress(tab.id)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-all"
                style={{ color: active ? "#f59e0b" : "#6b7280" }}
              >
                <span className="text-xl leading-none">{tab.icon}</span>
                <span className="text-xs font-500 leading-none mt-0.5">{tab.label}</span>
                {active && <div className="w-1 h-1 rounded-full mt-0.5" style={{ background: "#f59e0b" }} />}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Slide-over drawer */}
      {drawerOpen && (
        <>
          <div className="absolute inset-0 z-40" style={{ background: "#00000080" }} onClick={() => setDrawerOpen(false)} />
          <div className="absolute top-0 left-0 bottom-0 z-50 flex flex-col" style={{ width: 280, background: "#1a1d27", borderRight: "1px solid #2a2f42" }}>
            {/* Drawer header */}
            <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: "#2a2f42" }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#f59e0b" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="#0f1117" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span className="font-700 text-base" style={{ color: "#f0f2f5" }}>BuildAI</span>
              <button onClick={() => setDrawerOpen(false)} className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: "#252a3a", color: "#9ca3af" }}>✕</button>
            </div>
            {/* Profile */}
            <div className="px-4 py-3 border-b" style={{ borderColor: "#2a2f42" }}>
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: "#252a3a" }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-700 text-sm" style={{ background: cfg.color + "30", color: cfg.color }}>{cfg.initials}</div>
                <div>
                  <div className="font-600 text-sm" style={{ color: "#f0f2f5" }}>{cfg.name}</div>
                  <div className="text-xs" style={{ color: cfg.color }}>{cfg.label}</div>
                </div>
              </div>
            </div>
            {/* All nav items */}
            <div className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
              {[...tabs.filter(t => !t.id.startsWith("more-")), ...(cfg.more as NavItem[])].map(item => {
                const active = section === item.id;
                return (
                  <button key={item.id} onClick={() => { onNav(item.id); setDrawerOpen(false); }} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all" style={{ background: active ? "#f59e0b15" : "transparent", color: active ? "#f59e0b" : "#9ca3af", borderLeft: active ? "2px solid #f59e0b" : "2px solid transparent" }}>
                    <span className="text-lg w-6 text-center">{item.icon}</span>
                    <span className="font-500 text-sm">{item.label}</span>
                  </button>
                );
              })}
            </div>
            {/* Logout */}
            <div className="px-3 py-3 border-t" style={{ borderColor: "#2a2f42" }}>
              <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl" style={{ color: "#ef4444" }}>
                <span>⟵</span><span className="font-500 text-sm">Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* More sheet */}
      {moreOpen && (
        <>
          <div className="absolute inset-0 z-40" style={{ background: "#00000060" }} onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 z-50 rounded-t-2xl overflow-hidden" style={{ background: "#1a1d27", border: "1px solid #2a2f42", maxWidth: 480, margin: "0 auto" }}>
            <div className="flex items-center justify-between px-4 py-4 border-b" style={{ borderColor: "#2a2f42" }}>
              <span className="font-700 text-base" style={{ color: "#f0f2f5" }}>More</span>
              <button onClick={() => setMoreOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-sm" style={{ background: "#252a3a", color: "#9ca3af" }}>✕</button>
            </div>
            <div className="grid grid-cols-3 gap-3 p-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
              {(cfg.more as NavItem[]).map(item => (
                <button key={item.id} onClick={() => handleMoreNav(item.id)} className="flex flex-col items-center gap-2 py-4 rounded-2xl transition-all" style={{ background: "#252a3a" }}>
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-xs font-500 text-center" style={{ color: "#9ca3af" }}>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
