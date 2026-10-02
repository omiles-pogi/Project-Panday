import { useState } from "react";
import Login from "./components/Login";
import MobileLayout from "./components/MobileLayout";
import { PlanProvider } from "./lib/ai/PlanContext";

// Homeowner
import HomeownerDashboard from "./components/homeowner/Dashboard";
import ProjectChat from "./components/homeowner/ProjectChat";
import BudgetGenerator from "./components/homeowner/BudgetGenerator";
import MaterialEstimator from "./components/homeowner/MaterialEstimator";
import LaborEstimator from "./components/homeowner/LaborEstimator";
import EquipmentEstimator from "./components/homeowner/EquipmentEstimator";
import AIDesign from "./components/homeowner/AIDesign";
import ApprovalCenter from "./components/homeowner/ApprovalCenter";
import ContractorMarketplace from "./components/homeowner/ContractorMarketplace";
import ProgressMonitor from "./components/homeowner/ProgressMonitor";
import BudgetMonitor from "./components/homeowner/BudgetMonitor";
import Expenses from "./components/homeowner/Expenses";

// Contractor
import ContractorDashboard from "./components/contractor/ContractorDashboard";
import AvailableProjects from "./components/contractor/AvailableProjects";
import CapacityMonitor from "./components/contractor/CapacityMonitor";
import EquipmentSchedule from "./components/contractor/EquipmentSchedule";
import ProjectManagement from "./components/contractor/ProjectManagement";
import ProgressReport from "./components/contractor/ProgressReport";
import ProgressAnalysis from "./components/contractor/ProgressAnalysis";
import WeeklyAnalytics from "./components/contractor/WeeklyAnalytics";

// Supplier
import SupplierDashboard from "./components/supplier/SupplierDashboard";
import SupplierBids from "./components/supplier/SupplierBids";
import SupplierOrders from "./components/supplier/SupplierOrders";
import SupplierPricing from "./components/supplier/SupplierPricing";

// Worker
import WorkerDashboard from "./components/worker/WorkerDashboard";
import WorkerAssignments from "./components/worker/WorkerAssignments";
import WorkerTimesheet from "./components/worker/WorkerTimesheet";
import WorkerDailyLog from "./components/worker/WorkerDailyLog";
import WorkerEarnings from "./components/worker/WorkerEarnings";
import WorkerSkills from "./components/worker/WorkerSkills";
import WorkerAttendance from "./components/worker/WorkerAttendance";

type Role = "homeowner" | "contractor" | "supplier" | "worker";

const defaultSection: Record<Role, string> = {
  homeowner: "dashboard",
  contractor: "contractor-dashboard",
  supplier: "supplier-dashboard",
  worker: "worker-dashboard",
};

function HomeownerContent({ section, onNav }: { section: string; onNav: (s: string) => void }) {
  switch (section) {
    case "dashboard": return <HomeownerDashboard onNav={onNav} />;
    case "create-project": return <ProjectChat />;
    case "ai-planner": return <ProjectChat />;
    case "budget": return <BudgetGenerator />;
    case "materials": return <MaterialEstimator />;
    case "labor": return <LaborEstimator />;
    case "equipment": return <EquipmentEstimator />;
    case "design": return <AIDesign />;
    case "approvals": return <ApprovalCenter />;
    case "marketplace": return <ContractorMarketplace />;
    case "progress": return <ProgressMonitor />;
    case "budget-monitor": return <BudgetMonitor />;
    case "expenses": return <Expenses />;
    default: return <HomeownerDashboard onNav={onNav} />;
  }
}

function ContractorContent({ section, onNav }: { section: string; onNav: (s: string) => void }) {
  switch (section) {
    case "contractor-dashboard": return <ContractorDashboard onNav={onNav} />;
    case "available-projects": return <AvailableProjects onNav={onNav} />;
    case "capacity-monitor": return <CapacityMonitor />;
    case "equipment-schedule": return <EquipmentSchedule />;
    case "project-management": return <ProjectManagement onNav={onNav} />;
    case "progress-report": return <ProgressReport />;
    case "progress-analysis": return <ProgressAnalysis />;
    case "weekly-analytics": return <WeeklyAnalytics />;
    default: return <ContractorDashboard onNav={onNav} />;
  }
}

function SupplierContent({ section }: { section: string }) {
  switch (section) {
    case "supplier-dashboard": return <SupplierDashboard />;
    case "supplier-bids": return <SupplierBids />;
    case "supplier-orders": return <SupplierOrders />;
    case "supplier-pricing": return <SupplierPricing />;
    default: return <SupplierDashboard />;
  }
}

function WorkerContent({ section, onNav }: { section: string; onNav: (s: string) => void }) {
  switch (section) {
    case "worker-dashboard": return <WorkerDashboard onNav={onNav} />;
    case "worker-assignments": return <WorkerAssignments />;
    case "worker-timesheet": return <WorkerTimesheet />;
    case "worker-daily-log": return <WorkerDailyLog />;
    case "worker-earnings": return <WorkerEarnings />;
    case "worker-skills": return <WorkerSkills />;
    case "worker-attendance": return <WorkerAttendance />;
    default: return <WorkerDashboard onNav={onNav} />;
  }
}

export default function App() {
  const [role, setRole] = useState<Role | null>(null);
  const [section, setSection] = useState<string>("dashboard");

  const handleLogin = (r: Role) => {
    setRole(r);
    setSection(defaultSection[r]);
  };

  const handleLogout = () => {
    setRole(null);
    setSection("dashboard");
  };

  const handleNav = (s: string) => setSection(s);

  if (!role) return <Login onLogin={handleLogin} />;

  return (
    <div className="h-full flex items-stretch justify-center" style={{ background: "#0a0c12" }}>
      <MobileLayout role={role} section={section} onNav={handleNav} onLogout={handleLogout}>
        {role === "homeowner" && (
          <PlanProvider>
            <HomeownerContent section={section} onNav={handleNav} />
          </PlanProvider>
        )}
        {role === "contractor" && <ContractorContent section={section} onNav={handleNav} />}
        {role === "supplier" && <SupplierContent section={section} />}
        {role === "worker" && <WorkerContent section={section} onNav={handleNav} />}
      </MobileLayout>
    </div>
  );
}
