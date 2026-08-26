export type MessageRole = "user" | "assistant" | "system";

export interface Message {
  id: string;
  chatId: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  tokenEstimate: number | null;
  images?: string[];
  documents?: Array<{ name: string; size?: number }>;
}

/** Payload dikirim ke /api/chat */
export interface ChatApiMessage {
  role: MessageRole;
  content: string;
}
