"use client";

import { AppShell } from "@/components/shared/AppShell";
import { ChatView } from "@/components/chat/ChatView";

export default function NewChatPage(): React.JSX.Element {
  return (
    <AppShell>
      <ChatView />
    </AppShell>
  );
}
