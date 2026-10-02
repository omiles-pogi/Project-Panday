import RoleTabs from "@/components/RoleTabs";

export default function WorkerTabsLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: "index", title: "Worker Dashboard", label: "Home", icon: "⊞" },
        { name: "assignments", title: "My Assignments", label: "Tasks", icon: "📋" },
        { name: "daily-log", title: "Daily Work Log", label: "Log", icon: "📝" },
        { name: "attendance", title: "Attendance", label: "Attendance", icon: "📅" },
        { name: "more", title: "More", label: "More", icon: "⋯" },
      ]}
    />
  );
}
