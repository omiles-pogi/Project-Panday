import ConversationList from "@/screens/chat/ConversationList";

export default function HomeownerMessages() {
  return <ConversationList chatPath={(id) => `/homeowner/messages/${id}`} />;
}
