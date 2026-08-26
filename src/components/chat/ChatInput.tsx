"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Square,
  Paperclip,
  FileText,
  X,
  Lightbulb,
  Reply,
  UploadCloud,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils/cn";
import { unpackZipFile } from "@/lib/utils/zip";
import { recordUserFile } from "@/lib/firebase/firestore";

export interface AttachedFile {
  id: string;
  name: string;
  type: "image" | "document";
  dataUrl?: string; // base64 for images preview / multimodal
  remoteUrl?: string; // Telegram Storage CDN URL
  textContent?: string; // parsed text for documents
  size: number;
}

interface ChatInputProps {
  onSend: (data: {
    text: string;
    displayText?: string;
    images?: string[];
    documents?: Array<{ name: string; size?: number }>;
  }) => void;
  onStop?: () => void;
  disabled?: boolean;
  streaming?: boolean;
  replyingTo?: string | null;
  onCancelReply?: () => void;
}

const MAX_HEIGHT = 180;
const MAX_FILE_SIZE_MB = 100; // 100 MB per file upload limit

function compressImage(file: File, maxDim = 1280, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ChatInput({
  onSend,
  onStop,
  disabled = false,
  streaming = false,
  replyingTo = null,
  onCancelReply,
}: ChatInputProps): React.JSX.Element {
  const { user } = useAuth();
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [reasonActive, setReasonActive] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef<number>(0);
  const { toast } = useToast();

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  // Focus textarea when replyingTo changes
  useEffect(() => {
    if (replyingTo) {
      textareaRef.current?.focus();
    }
  }, [replyingTo]);

  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    fileArray.forEach((file) => {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast("error", `File "${file.name}" terlalu besar (maksimal ${MAX_FILE_SIZE_MB}MB).`);
        return;
      }

      const isZip = file.name.endsWith(".zip") || file.type.includes("zip");
      const isImage = file.type.startsWith("image/");
      const ext = file.name.split(".").pop()?.toLowerCase();
      const unsupportedBinary = ["exe", "bin", "dll", "so", "class", "pyc", "7z", "rar", "tar", "gz"];

      if (ext && unsupportedBinary.includes(ext)) {
        toast("error", `Format file ".${ext}" tidak didukung. Silakan gunakan format kode/teks atau file .zip.`);
        return;
      }

      if (isZip) {
        toast("info", `Mengekstrak arsip ZIP "${file.name}"...`);
        unpackZipFile(file)
          .then((res) => {
            if (res.fileCount === 0) {
              toast("error", `Tidak ditemukan file kode/teks yang terbaca di dalam "${file.name}".`);
              return;
            }
            const attId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            setAttachments((prev) => [
              ...prev,
              {
                id: attId,
                name: `${file.name} (${res.fileCount} files)`,
                type: "document",
                textContent: res.formattedContent,
                size: res.totalSizeBytes,
              },
            ]);

            // Background upload to Telegram Cloud Storage with user metadata
            const uploadData = new FormData();
            uploadData.append("file", file);
            if (user) {
              uploadData.append("uid", user.uid);
              if (user.displayName) uploadData.append("name", user.displayName);
              if (user.email) uploadData.append("email", user.email);
            }

            fetch("/api/upload", {
              method: "POST",
              body: uploadData,
            })
              .then((r) => r.json())
              .then((upRes) => {
                if (upRes.success && upRes.url && user) {
                  void recordUserFile(user.uid, {
                    name: file.name,
                    size: file.size,
                    type: "file",
                    url: upRes.url,
                    fileId: upRes.fileId,
                  });
                }
              })
              .catch(() => {
                /* non-blocking */
              });

            toast("success", `Arsip ZIP "${file.name}" berhasil diekstrak (${res.fileCount} file kode).`);
          })
          .catch(() => {
            toast("error", `Gagal membaca isi file ZIP "${file.name}".`);
          });
        return;
      }

      if (isImage) {
        compressImage(file)
          .then((dataUrl) => {
            const attId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            setAttachments((prev) => [
              ...prev,
              {
                id: attId,
                name: file.name,
                type: "image",
                dataUrl,
                size: file.size,
              },
            ]);

            // Background upload to Telegram Cloud Storage with user metadata
            const uploadData = new FormData();
            uploadData.append("file", file);
            if (user) {
              uploadData.append("uid", user.uid);
              if (user.displayName) uploadData.append("name", user.displayName);
              if (user.email) uploadData.append("email", user.email);
            }

            fetch("/api/upload", {
              method: "POST",
              body: uploadData,
            })
              .then((r) => r.json())
              .then((res) => {
                if (res.success && res.url) {
                  setAttachments((prev) =>
                    prev.map((a) => (a.id === attId ? { ...a, remoteUrl: res.url } : a))
                  );
                  if (user) {
                    void recordUserFile(user.uid, {
                      name: file.name,
                      size: file.size,
                      type: "image",
                      url: res.url,
                      fileId: res.fileId,
                    });
                  }
                }
              })
              .catch(() => {
                /* fallback to base64 */
              });

            toast("success", `Gambar "${file.name}" dilampirkan.`);
          })
          .catch(() => {
            toast("error", `Gagal memproses gambar "${file.name}".`);
          });
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const textContent = e.target?.result as string;
          const attId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          setAttachments((prev) => [
            ...prev,
            {
              id: attId,
              name: file.name,
              type: "document",
              textContent,
              size: file.size,
            },
          ]);

          // Background upload to Telegram Cloud Storage with user metadata
          const uploadData = new FormData();
          uploadData.append("file", file);
          if (user) {
            uploadData.append("uid", user.uid);
            if (user.displayName) uploadData.append("name", user.displayName);
            if (user.email) uploadData.append("email", user.email);
          }

          fetch("/api/upload", {
            method: "POST",
            body: uploadData,
          })
            .then((r) => r.json())
            .then((upRes) => {
              if (upRes.success && upRes.url && user) {
                void recordUserFile(user.uid, {
                  name: file.name,
                  size: file.size,
                  type: "file",
                  url: upRes.url,
                  fileId: upRes.fileId,
                });
              }
            })
            .catch(() => {
              /* non-blocking */
            });

          toast("success", `Dokumen "${file.name}" dilampirkan.`);
        };
        reader.readAsText(file);
      }
    });
  }, [toast, user]);

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const filesToProcess: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) filesToProcess.push(file);
      }
    }
    if (filesToProcess.length > 0) {
      processFiles(filesToProcess);
    }
  };

  const removeAttachment = (id: string): void => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Drag and Drop handlers
  const handleDragEnter = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      setIsDragging(false);
      dragCounterRef.current = 0;
    }
  };

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
      textareaRef.current?.focus();
    }
  };

  const submit = useCallback(() => {
    const text = value.trim();
    if ((!text && attachments.length === 0) || disabled || streaming) return;

    const userDisplayText = text;
    let fullPromptForAI = text || (attachments.length > 0 ? "Analisis lampiran ini." : "");

    // If replying to AI response, prepend quote context
    if (replyingTo) {
      const cleanSnippet = replyingTo.slice(0, 200).replace(/\n/g, " ");
      fullPromptForAI = `[Membalas bagian jawaban Codzy: "${cleanSnippet}..."]\n\n${fullPromptForAI}`;
      onCancelReply?.();
    }

    // Build document context for AI prompt
    const docFiles = attachments.filter((a) => a.type === "document" && a.textContent);
    const docMetadata = docFiles.map((d) => ({ name: d.name, size: d.size }));

    if (docFiles.length > 0) {
      const docSections = docFiles
        .map((d) => `--- [Dokumen: ${d.name}] ---\n${d.textContent}\n--- [Akhir Dokumen ${d.name}] ---`)
        .join("\n\n");
      fullPromptForAI = `${docSections}\n\n${fullPromptForAI}`;
    }

    if (reasonActive) {
      fullPromptForAI = `[Deep Reason]\n${fullPromptForAI}`;
    }

    const images = attachments
      .filter((a) => a.type === "image" && (a.dataUrl || a.remoteUrl))
      .map((a) => (a.dataUrl || a.remoteUrl) as string);

    onSend({
      text: fullPromptForAI,
      displayText: userDisplayText,
      images: images.length > 0 ? images : undefined,
      documents: docMetadata.length > 0 ? docMetadata : undefined,
    });

    setValue("");
    setAttachments([]);
  }, [value, attachments, disabled, streaming, replyingTo, onCancelReply, reasonActive, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="w-full bg-gradient-to-t from-background via-background to-transparent px-4 pb-4 pt-2"
    >
      <div className="mx-auto max-w-3xl space-y-2">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.txt,.md,.json,.js,.ts,.tsx,.jsx,.py,.html,.css,.csv,.doc,.docx,.zip"
          onChange={(e) => {
            if (e.target.files) {
              processFiles(e.target.files);
              e.target.value = "";
            }
          }}
          className="hidden"
        />

        {/* Floating Input Box with Drag & Drop Overlay */}
        <div
          className={cn(
            "relative rounded-2xl border bg-card/80 p-3 shadow-xl backdrop-blur-md transition-all focus-within:border-foreground/30",
            isDragging
              ? "border-primary border-dashed bg-accent/70 ring-2 ring-primary/40"
              : "border-border/90"
          )}
        >
          {/* Drag & Drop Overlay Indicator */}
          {isDragging && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-background/85 backdrop-blur-xs text-foreground animate-fade-in pointer-events-none">
              <UploadCloud className="h-8 w-8 text-primary animate-bounce mb-1" />
              <span className="text-xs font-bold">Lepaskan file di sini untuk melampirkan</span>
              <span className="text-[10px] text-muted-foreground">Maks. 100 MB per file (Gambar, PDF, Dokumen, ZIP, dan Kode)</span>
            </div>
          )}

          {/* Replying To Banner */}
          {replyingTo && (
            <div className="flex items-center justify-between gap-2 pb-2 mb-1.5 border-b border-border/50 bg-accent/40 rounded-xl px-2.5 py-1.5 text-xs text-foreground">
              <div className="flex items-center gap-1.5 min-w-0">
                <Reply className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground shrink-0 font-medium">
                  Membalas Codzy:
                </span>
                <span className="truncate text-[11px] italic text-foreground max-w-[200px] sm:max-w-md">
                  "{replyingTo.slice(0, 100)}..."
                </span>
              </div>
              <button
                type="button"
                onClick={onCancelReply}
                aria-label="Batalkan balasan"
                className="flex h-5 w-5 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Attachment Previews */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-2.5 mb-1.5 border-b border-border/50">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="relative group flex items-center gap-2 rounded-xl border border-border bg-background/80 p-1.5 pr-2.5 text-xs shadow-xs"
                >
                  {att.type === "image" && (att.dataUrl || att.remoteUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={att.dataUrl || att.remoteUrl}
                      alt={att.name}
                      className="h-9 w-9 rounded-lg object-cover border border-border/50"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <FileText className="h-4 w-4" />
                    </div>
                  )}

                  <div className="max-w-[120px] sm:max-w-[180px] min-w-0">
                    <span className="block truncate font-medium text-foreground text-[11px]">
                      {att.name}
                    </span>
                    <span className="block text-[9px] text-muted-foreground">
                      {(att.size / 1024).toFixed(0)} KB
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    aria-label={`Hapus ${att.name}`}
                    className="flex h-4 w-4 items-center justify-center rounded-full bg-muted hover:bg-destructive hover:text-destructive-foreground transition-colors ml-0.5"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={`Tulis pesan untuk ${APP_NAME}... (bisa drag & drop file, maks 100MB)`}
            rows={1}
            disabled={disabled}
            className="w-full resize-none bg-transparent px-1 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 min-h-[44px]"
            style={{ maxHeight: MAX_HEIGHT }}
          />

          {/* Bottom Toolbar */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
            {/* Left Options */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                title="Unggah Foto atau Dokumen (Maks 100 MB)"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-7 items-center gap-1.5 rounded-lg border border-border/80 bg-background/50 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Paperclip className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-[11px]">Attach</span>
              </button>

              {/* Reason Toggle Pill */}
              <button
                type="button"
                onClick={() => {
                  setReasonActive((v) => !v);
                  toast("info", !reasonActive ? "Deep Reason diaktifkan." : "Deep Reason dinonaktifkan.");
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-all active:scale-[0.98]",
                  reasonActive
                    ? "border-foreground/40 bg-accent text-foreground font-medium shadow-xs"
                    : "border-border/80 bg-background/50 text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <Lightbulb className="h-3.5 w-3.5" />
                <span>Reason</span>
              </button>
            </div>

            {/* Right: Send / Stop Button */}
            <div className="flex items-center gap-1.5 shrink-0">
              {streaming && onStop ? (
                <button
                  type="button"
                  onClick={onStop}
                  aria-label="Hentikan generasi"
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-destructive text-destructive-foreground hover:opacity-90 active:scale-95 transition-all shadow-sm"
                >
                  <Square className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={disabled || streaming || (value.trim().length === 0 && attachments.length === 0)}
                  aria-label="Kirim pesan"
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40 disabled:pointer-events-none hover:opacity-90 active:scale-95 transition-all shadow-sm"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Disclaimer Footer */}
        <p className="text-center text-[11px] text-muted-foreground/80">
          {APP_NAME} dapat membuat kesalahan. Pertimbangkan untuk memeriksa informasi penting.
        </p>
      </div>
    </div>
  );
}
