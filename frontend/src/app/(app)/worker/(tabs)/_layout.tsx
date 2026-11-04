import RoleTabs from "@/components/RoleTabs";
import { useChat } from "@/context/ChatContext";

// Three main tabs; the rest stay reachable from the side menu.
export default function WorkerTabsLayout() {
  const { unreadCount } = useChat();
  return (
    <RoleTabs
      tabs={[
        { name: "index", title: "Worker Dashboard", label: "Home", icon: "home-outline" },
        { name: "assignments", title: "My Assignments", label: "Tasks", icon: "briefcase-outline" },
        { name: "messages", title: "Messages", label: "Chat", icon: "chatbubbles-outline", badge: unreadCount },
        { name: "more", title: "More", label: "More", icon: "ellipsis-horizontal", hidden: true },
      ]}
    />
  );
}
