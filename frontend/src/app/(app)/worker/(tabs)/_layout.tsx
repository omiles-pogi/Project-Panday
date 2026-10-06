import RoleTabs from "@/components/RoleTabs";

export default function WorkerTabsLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: "index", title: "Worker Dashboard", label: "Home", icon: "home-outline" },
        { name: "assignments", title: "My Assignments", label: "Tasks", icon: "briefcase-outline" },
        { name: "daily-log", title: "Daily Work Log", label: "Log", icon: "document-text-outline" },
        { name: "attendance", title: "Attendance", label: "Attendance", icon: "calendar-outline" },
        { name: "more", title: "More", label: "More", icon: "ellipsis-horizontal" },
      ]}
    />
  );
}
