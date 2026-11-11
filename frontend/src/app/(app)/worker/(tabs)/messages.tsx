import ConversationList from "@/screens/chat/ConversationList";
import { Tabs } from "expo-router";
import WorkerHeader from "@/components/WorkerHeader";

export default function WorkerMessages() {
  return <><Tabs.Screen options={{ header: () => <WorkerHeader /> }} /><ConversationList chatPath={(id) => `/worker/chat/${id}`} /></>;
}
