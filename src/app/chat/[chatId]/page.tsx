"use client";

import { AppShell } from "@/components/shared/AppShell";
import { ChatView } from "@/components/chat/ChatView";

interface ChatDetailPageProps {
  params: { chatId: string };
}

export default function ChatDetailPage({
  params,
}: ChatDetailPageProps): React.JSX.Element {
  return (
    <AppShell>
      <ChatView chatId={params.chatId} />
    </AppShell>
  );
}
