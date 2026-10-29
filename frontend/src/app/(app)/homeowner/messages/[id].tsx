import { useLocalSearchParams } from "expo-router";
import ChatWindow from "@/screens/chat/ChatWindow";

export default function HomeownerChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ChatWindow key={id} conversationId={Number(id)} />;
}
