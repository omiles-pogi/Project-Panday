import ConversationList from "@/screens/chat/ConversationList";

export default function WorkerMessages() {
  return <ConversationList chatPath={(id) => `/worker/chat/${id}`} />;
}
