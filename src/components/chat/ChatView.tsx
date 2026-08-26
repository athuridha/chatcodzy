"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  RefreshCw,
  Sun,
  Moon,
  ArrowDown,
  LogIn,
  ShieldAlert,
} from "lucide-react";

import { ChatInput } from "./ChatInput";
import { EmptyState } from "./EmptyState";
import { MessageBubble } from "./MessageBubble";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth, useAuthToken } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/contexts/ToastContext";
import {
  createChat,
  fetchChatWithMessages,
  saveMessage,
} from "@/lib/firebase/firestore";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils/cn";
import type { ChatApiMessage } from "@/types/message";

interface ChatViewProps {
  chatId?: string;
}

interface LocalMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
  images?: string[];
  documents?: Array<{ name: string; size?: number }>;
}

export const CHATS_CHANGED_EVENT = "codzy:chats-changed";
const GUEST_MAX_MESSAGES = 5;
const GUEST_STORAGE_KEY = "codzy_guest_msg_count";

function emitChatsChanged(): void {
  window.dispatchEvent(new Event(CHATS_CHANGED_EVENT));
}

async function readSSEStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (fullText: string) => void,
  signal?: AbortSignal
): Promise<{ text: string; error: string | null }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";
  let streamError: string | null = null;

  const processLine = (line: string): void => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") return;

    try {
      const parsed = JSON.parse(payload) as { delta?: string; error?: string };
      if (parsed.error) {
        streamError = parsed.error;
      } else if (parsed.delta) {
        accumulated += parsed.delta;
        onDelta(accumulated);
      }
    } catch {
      // skip
    }
  };

  try {
    for (;;) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) processLine(line);
    }
    if (buffer.trim()) processLine(buffer);
  } finally {
    reader.releaseLock();
  }

  return { text: accumulated, error: streamError };
}

export function ChatView({ chatId }: ChatViewProps): React.JSX.Element {
  const { user } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const getToken = useAuthToken();
  const { toast } = useToast();
  const router = useRouter();

  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(Boolean(chatId && user));
  const [error, setError] = useState<string | null>(null);

  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [showGuestLimitModal, setShowGuestLimitModal] = useState(false);
  const [guestCount, setGuestCount] = useState<number>(0);

  const abortRef = useRef<AbortController | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollEnabledRef = useRef<boolean>(true);

  // Sync guest message count from localStorage
  useEffect(() => {
    if (!user && typeof window !== "undefined") {
      const stored = parseInt(localStorage.getItem(GUEST_STORAGE_KEY) || "0", 10);
      setGuestCount(isNaN(stored) ? 0 : stored);
    }
  }, [user]);

  // Load chat history if chatId is present and user is logged in
  useEffect(() => {
    if (!user) {
      setMessages([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (!chatId) {
      setMessages([]);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    fetchChatWithMessages(chatId)
      .then((data) => {
        if (!active) return;
        if (!data || data.userId !== user.uid) {
          setError("Percakapan tidak ditemukan atau bukan milikmu.");
          setMessages([]);
        } else {
          setMessages(
            data.messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: m.timestamp
                ? new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : undefined,
              images: m.images,
              documents: m.documents,
            }))
          );
        }
        setLoading(false);
        setTimeout(() => scrollToBottom(false), 50);
      })
      .catch(() => {
        if (!active) return;
        setError("Gagal memuat percakapan. Cek koneksi lalu coba lagi.");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [chatId, user]);

  // SMART AUTO-SCROLL: only auto-scrolls if user hasn't scrolled up
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isAtBottom = distanceToBottom < 100;
    isAutoScrollEnabledRef.current = isAtBottom;
    setShowScrollBottomBtn(!isAtBottom);
  };

  const scrollToBottom = (smooth = true) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
    isAutoScrollEnabledRef.current = true;
    setShowScrollBottomBtn(false);
  };

  useEffect(() => {
    if (isAutoScrollEnabledRef.current) {
      const el = scrollContainerRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [messages.length, streamText]);

  // Send message handler (supporting both Auth Users and Guest Mode up to 5 messages)
  const handleSend = useCallback(
    async (
      payload:
        | string
        | {
            text: string;
            displayText?: string;
            images?: string[];
            documents?: Array<{ name: string; size?: number }>;
          },
      overrideHistory?: LocalMessage[]
    ): Promise<void> => {
      if (streaming) return;

      // Guest usage check
      if (!user) {
        const currentCount = parseInt(localStorage.getItem(GUEST_STORAGE_KEY) || "0", 10);
        if (currentCount >= GUEST_MAX_MESSAGES) {
          setShowGuestLimitModal(true);
          return;
        }
      }

      const promptText = typeof payload === "string" ? payload : payload.text;
      const displayText =
        typeof payload === "object" && payload.displayText !== undefined
          ? payload.displayText
          : promptText;
      const images = typeof payload === "object" ? payload.images : undefined;
      const documents = typeof payload === "object" ? payload.documents : undefined;

      let token: string | null = "guest";
      if (user) {
        token = await getToken();
        if (!token) {
          toast("error", "Sesi berakhir. Silakan login ulang.");
          return;
        }
      }

      setStreaming(true);
      setStreamText("");
      isAutoScrollEnabledRef.current = true;

      let targetChatId = chatId ?? null;
      let assistantText = "";
      const controller = new AbortController();
      abortRef.current = controller;

      const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      try {
        if (user) {
          if (!targetChatId) {
            targetChatId = await createChat(
              user.uid,
              (displayText || promptText).slice(0, 100)
            );
          }
          await saveMessage(targetChatId, {
            role: "user",
            content: displayText,
            images,
            documents,
          });
        } else {
          // Increment guest usage count
          const nextCount = (parseInt(localStorage.getItem(GUEST_STORAGE_KEY) || "0", 10) || 0) + 1;
          localStorage.setItem(GUEST_STORAGE_KEY, nextCount.toString());
          setGuestCount(nextCount);
        }
        
        const baseHistory = overrideHistory ?? messages;
        const newUserMsg: LocalMessage = {
          id: `local-user-${Date.now()}`,
          role: "user",
          content: displayText,
          timestamp: currentTime,
          images,
          documents,
        };

        setMessages([...baseHistory, newUserMsg]);

        const history: ChatApiMessage[] = baseHistory.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: {
            Authorization: user ? `Bearer ${token}` : "Bearer guest",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chatId: targetChatId,
            message: promptText,
            images,
            history,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          let apiMessage = `Permintaan gagal (${res.status}).`;
          try {
            const data = (await res.json()) as { error?: string };
            if (data.error) apiMessage = data.error;
          } catch {
            /* ignore */
          }
          throw new Error(apiMessage);
        }

        const result = await readSSEStream(
          res.body,
          (full) => setStreamText(full),
          controller.signal
        );
        assistantText = result.text;

        if (result.error && !assistantText) {
          throw new Error(result.error);
        }

        if (assistantText.trim()) {
          if (user && targetChatId) {
            await saveMessage(targetChatId, {
              role: "assistant",
              content: assistantText,
            });
          }
          setMessages((prev) => [
            ...prev,
            {
              id: `local-assistant-${Date.now()}`,
              role: "assistant",
              content: assistantText,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          toast("info", "Generasi dihentikan.");
        } else {
          console.error("handleSend:", err);
          toast(
            "error",
            err instanceof Error ? err.message : "Terjadi kesalahan tak terduga."
          );
        }
      } finally {
        const aborted = !abortRef.current || abortRef.current.signal.aborted;
        if (aborted && assistantText.trim() && targetChatId && user) {
          try {
            await saveMessage(targetChatId, {
              role: "assistant",
              content: assistantText,
            });
            setMessages((prev) => [
              ...prev,
              {
                id: `local-assistant-partial-${Date.now()}`,
                role: "assistant",
                content: assistantText,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              },
            ]);
          } catch {
            /* best effort */
          }
        }

        if (user && targetChatId && targetChatId !== chatId) {
          emitChatsChanged();
          router.replace(`/chat/${targetChatId}`, { scroll: false });
        } else if (user) {
          emitChatsChanged();
        }

        setStreaming(false);
        setStreamText("");
        abortRef.current = null;
      }
    },
    [chatId, getToken, messages, router, streaming, toast, user]
  );

  const handleEditMessage = (messageId: string, newText: string): void => {
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;

    const priorHistory = messages.slice(0, idx);
    void handleSend(
      {
        text: newText,
        displayText: newText,
        images: messages[idx]?.images,
        documents: messages[idx]?.documents,
      },
      priorHistory
    );
  };

  const handleReplyMessage = (content: string): void => {
    setReplyingTo(content);
  };

  const handleRetryLastMessage = (): void => {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMessage) {
      void handleSend({
        text: lastUserMessage.content,
        displayText: lastUserMessage.content,
        images: lastUserMessage.images,
        documents: lastUserMessage.documents,
      });
    }
  };

  const displayName = user?.displayName ?? "Tamu";

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="max-w-sm text-center text-sm text-muted-foreground">{error}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" /> Muat ulang
          </Button>
          <Button onClick={() => router.push("/chat")}>Mulai chat baru</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background relative">
      {/* Top Navigation Bar */}
      <header className="flex h-14 items-center justify-end border-b border-border/80 px-4 md:px-6 bg-background/95 backdrop-blur z-20">
        {/* Right Action Controls: Login Button for Guest & Dark/Light Theme Switcher */}
        <div className="flex items-center gap-2">
          {!user && (
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-all shadow-xs"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Masuk</span>
            </Link>
          )}

          {/* Dark / Light Mode Toggle Button */}
          <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            title={`Ganti ke mode ${resolvedTheme === "dark" ? "terang" : "gelap"}`}
            aria-label="Toggle tema gelap atau terang"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 bg-card/60 text-muted-foreground hover:text-foreground hover:bg-accent transition-all active:scale-95 shadow-xs"
          >
            {resolvedTheme === "dark" ? (
              <Sun className="h-4 w-4 transition-transform rotate-0" />
            ) : (
              <Moon className="h-4 w-4 transition-transform rotate-0" />
            )}
          </button>
        </div>
      </header>

      {/* Messages Scroll Area with Smooth Manual Scroll Support */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        <div className="mx-auto flex min-h-full max-w-4xl flex-col pb-6">
          {loading ? (
            <div className="flex flex-1 flex-col gap-4 px-4 py-8 max-w-3xl mx-auto w-full">
              {[0, 1, 2].map((i) => (
                <div key={i} className={cn("flex gap-3", i % 2 === 1 && "justify-end")}>
                  <Skeleton
                    className={cn("h-20 rounded-2xl", i % 2 === 1 ? "w-1/2" : "w-3/4")}
                  />
                </div>
              ))}
            </div>
          ) : messages.length === 0 && !streaming ? (
            <EmptyState
              displayName={displayName}
              onSuggestion={(s) => void handleSend(s)}
            />
          ) : (
            <div className="pt-4 space-y-2">
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={{
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    timestamp: m.timestamp,
                    images: m.images,
                    documents: m.documents,
                  }}
                  onEdit={handleEditMessage}
                  onReply={handleReplyMessage}
                  onRetry={m.role === "assistant" ? handleRetryLastMessage : undefined}
                />
              ))}

              {/* Streaming AI Bubble */}
              {streaming && (
                <div className="w-full max-w-4xl mx-auto px-4 py-3">
                  <div className="rounded-2xl border border-border bg-card/70 p-5 md:p-6 shadow-sm space-y-3 animate-pulse">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground">
                        {APP_NAME} sedang berpikir…
                      </span>
                    </div>
                    {streamText ? (
                      <div className="text-sm text-card-foreground">
                        <MessageBubble
                          message={{ role: "assistant", content: streamText }}
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground pl-1">
                        Memproses pemikiran & jawaban…
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottomBtn && (
        <button
          onClick={() => scrollToBottom(true)}
          title="Scroll ke bawah"
          aria-label="Scroll ke pesan terbaru"
          className="absolute bottom-24 right-6 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg hover:bg-accent transition-all active:scale-95 animate-fade-in"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}

      {/* Floating Chat Input Bar */}
      <ChatInput
        onSend={(payload) => void handleSend(payload)}
        onStop={() => abortRef.current?.abort()}
        disabled={false}
        streaming={streaming}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
      />

      {/* Guest Limit Modal (5 Messages Exceeded) */}
      {showGuestLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20">
              <ShieldAlert className="h-6 w-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-foreground">
                Batas Pesan Tercapai
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Anda telah mencapai batas pesan dalam mode tamu. Masuk dengan akun Google atau Email untuk melanjutkan percakapan tanpa batas.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                className="w-full rounded-xl"
                onClick={() => router.push("/login")}
              >
                <LogIn className="h-4 w-4 mr-2" /> Masuk / Daftar Sekarang
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-xl text-xs"
                onClick={() => setShowGuestLimitModal(false)}
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
