import ConversationList from "@/screens/chat/ConversationList";

export default function ContractorMessages() {
  return <ConversationList chatPath={(id) => `/contractor/chat/${id}`} />;
}
