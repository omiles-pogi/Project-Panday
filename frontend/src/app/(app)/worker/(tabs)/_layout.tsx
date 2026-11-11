import RoleTabs from "@/components/RoleTabs";

// Four main tabs, like the homeowner app; the rest stay reachable from the side menu.
export default function WorkerTabsLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: "index", title: "Worker Dashboard", label: "Home", icon: "home-outline" },
        { name: "available", title: "Available Projects", label: "Browse", icon: "list-outline" },
        { name: "assignments", title: "My Assignments", label: "Tasks", icon: "briefcase-outline" },
        { name: "skills", title: "Skills & Profile", label: "Skills", icon: "build-outline" },
        { name: "messages", title: "Messages", label: "Chat", icon: "chatbubbles-outline", hidden: true },
        { name: "more", title: "More", label: "More", icon: "ellipsis-horizontal", hidden: true },
      ]}
    />
  );
}
