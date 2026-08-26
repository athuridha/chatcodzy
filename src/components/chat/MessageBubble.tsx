"use client";

import { memo, useState } from "react";
import {
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RotateCw,
  Pencil,
  Reply,
  X,
  Send,
  FileText,
} from "lucide-react";

import { MarkdownRenderer } from "./MarkdownRenderer";
import { useToast } from "@/contexts/ToastContext";
import { cn } from "@/lib/utils/cn";
import type { Message } from "@/types/message";

interface MessageBubbleProps {
  message: Pick<Message, "role" | "content"> & {
    id?: string;
    timestamp?: string;
    images?: string[];
    documents?: Array<{ name: string; size?: number }>;
  };
  onEdit?: (messageId: string, newText: string) => void;
  onReply?: (content: string) => void;
  onRetry?: () => void;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  onEdit,
  onReply,
  onRetry,
}: MessageBubbleProps): React.JSX.Element {
  const isUser = message.role === "user";
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast("success", "Teks berhasil disalin.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("error", "Gagal menyalin teks.");
    }
  };

  const handleFeedback = (type: "up" | "down"): void => {
    if (feedback === type) {
      setFeedback(null);
    } else {
      setFeedback(type);
      toast("info", type === "up" ? "Terima kasih atas tanggapan positifmu!" : "Tanggapan telah dicatat.");
    }
  };

  const handleSaveEdit = (): void => {
    if (!editText.trim()) {
      toast("error", "Pesan tidak boleh kosong.");
      return;
    }
    if (message.id && onEdit) {
      onEdit(message.id, editText.trim());
      setIsEditing(false);
    }
  };

  // User Message Rendering
  if (isUser) {
    return (
      <div className="group flex flex-col items-end px-4 py-3 max-w-4xl mx-auto w-full">
        {/* Documents attached by user */}
        {message.documents && message.documents.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 justify-end">
            {message.documents.map((doc, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2.5 rounded-xl border border-border/90 bg-card/90 px-3 py-2 text-xs shadow-xs backdrop-blur-xs"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-foreground">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="max-w-[200px] text-left min-w-0">
                  <span className="block truncate font-semibold text-foreground text-xs">
                    {doc.name}
                  </span>
                  {doc.size !== undefined && (
                    <span className="block text-[10px] text-muted-foreground">
                      {(doc.size / 1024).toFixed(1)} KB
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Images attached by user */}
        {message.images && message.images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 justify-end">
            {message.images.map((imgUrl, idx) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={idx}
                src={imgUrl}
                alt="Lampiran user"
                className="max-h-48 max-w-xs rounded-xl object-cover border border-border/80 shadow-sm"
              />
            ))}
          </div>
        )}

        {isEditing ? (
          <div className="w-full max-w-xl rounded-2xl border border-foreground/30 bg-card p-3 shadow-lg space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl bg-background/80 p-2.5 text-sm text-foreground focus:outline-none border border-border"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditText(message.content);
                  setIsEditing(false);
                }}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" /> Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 transition-all shadow-xs"
              >
                <Send className="h-3 w-3" /> Simpan & Kirim
              </button>
            </div>
          </div>
        ) : (
          <div className="relative flex items-center gap-2 max-w-full justify-end">
            {/* Quick Action on hover (Edit & Copy) */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
              <button
                onClick={() => setIsEditing(true)}
                title="Edit pesan ini"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => void handleCopy()}
                title="Salin pesan"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>

            <div className="max-w-[85%] sm:max-w-[70%] rounded-2xl bg-muted/90 text-foreground border border-border/80 px-4 py-3 text-sm shadow-sm">
              <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
            </div>
          </div>
        )}

        <span className="mt-1 pr-1 text-[10px] text-muted-foreground">
          {message.timestamp || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    );
  }

  // Assistant Message Rendering
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-3">
      <div className="rounded-2xl border border-border/90 bg-card/60 p-5 md:p-6 shadow-sm backdrop-blur-xs space-y-4">
        {/* Top Header inside Card */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold tracking-tight text-foreground">
            Codzy
          </span>
        </div>

        {/* Content Body */}
        <div className="text-sm text-card-foreground leading-relaxed">
          <MarkdownRenderer content={message.content} />
        </div>

        {/* Bottom Actions Bar */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/60">
          {/* Left: Feedback & Utility Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => void handleCopy()}
              title="Salin teks"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-foreground" /> : <Copy className="h-3.5 w-3.5" />}
            </button>

            <button
              onClick={() => handleFeedback("up")}
              title="Suka jawaban"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                feedback === "up"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={() => handleFeedback("down")}
              title="Tidak suka"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                feedback === "down"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>

            {onRetry && (
              <button
                onClick={onRetry}
                title="Buat ulang jawaban"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Right: Reply Button to quote and respond to AI */}
          {onReply && (
            <button
              onClick={() => onReply(message.content)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-background/80 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-all active:scale-[0.98]"
            >
              <Reply className="h-3.5 w-3.5" />
              <span>Reply</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
