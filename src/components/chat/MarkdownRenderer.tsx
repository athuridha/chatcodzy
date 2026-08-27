"use client";

import { memo, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy, Terminal, Download, Maximize2, X, Loader2 } from "lucide-react";
import "highlight.js/styles/github-dark.css";

import { useToast } from "@/contexts/ToastContext";
import { cn } from "@/lib/utils/cn";
import { ArtifactPreview } from "./ArtifactPreview";

interface MarkdownRendererProps {
  content: string;
}

function extractText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(extractText).join("");
  if (children && typeof children === "object" && "props" in children) {
    return extractText((children as { props: { children?: React.ReactNode } }).props.children);
  }
  return "";
}

function CodeBlockHeader({
  language,
  rawCode,
  children,
}: {
  language: string;
  rawCode: string;
  children: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawCode);
      setCopied(true);
      toast("success", `Kode ${language ? `(${language})` : ""} berhasil disalin.`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("error", "Gagal menyalin kode.");
    }
  };

  return (
    <div className="relative my-3 overflow-hidden rounded-xl border border-border/80 bg-[#0d1117] text-gray-100 shadow-md">
      {/* Code Header Bar with Language & Copy Button */}
      <div className="flex h-9 items-center justify-between border-b border-white/10 bg-neutral-900/90 px-3.5 select-none">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
          <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-semibold text-gray-300 lowercase">
            {language || "code"}
          </span>
        </div>

        <button
          onClick={handleCopy}
          type="button"
          aria-label="Salin kode ke clipboard"
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-gray-400 hover:bg-neutral-800 hover:text-white transition-all active:scale-95"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[11px] font-sans text-emerald-400 font-medium">Tersalin!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span className="text-[11px] font-sans">Salin</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body with strictly preserved whitespace */}
      <div className="overflow-x-auto p-4 font-mono text-xs sm:text-sm leading-relaxed text-[#c9d1d9]">
        {children}
      </div>
    </div>
  );
}

function GeneratedImageCard({ src, alt }: { src?: string; alt?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  if (!src) return null;

  // Direct instant download without navigating to third party website
  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (downloading) return;

    setDownloading(true);
    toast("info", "Sedang mengunduh gambar...");

    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `codzy-ai-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
      toast("success", "Gambar berhasil disimpan ke perangkat.");
    } catch {
      // Fallback
      const a = document.createElement("a");
      a.href = src;
      a.download = `codzy-ai-${Date.now()}.jpg`;
      a.target = "_blank";
      a.click();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="my-4 max-w-md rounded-2xl border border-border/80 bg-card overflow-hidden shadow-lg group relative">
      <div className="relative aspect-square w-full bg-muted/40 flex items-center justify-center overflow-hidden">
        {!loaded && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/30 animate-pulse">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Menghasilkan gambar AI...</span>
          </div>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt || "Gambar AI"}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          onClick={() => setModalOpen(true)}
          className={cn(
            "w-full h-full object-cover cursor-pointer transition-all duration-300 group-hover:scale-102",
            loaded ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Hover Action Overlay */}
        {loaded && (
          <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 backdrop-blur-md rounded-xl p-1 shadow-md">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              title="Unduh Gambar Langsung"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white hover:bg-white/20 transition-colors"
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              title="Perbesar"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white hover:bg-white/20 transition-colors"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {alt && (
        <div className="p-2.5 px-3 border-t border-border/60 bg-background/50">
          <p className="text-[11px] text-muted-foreground truncate">{alt}</p>
        </div>
      )}

      {/* Fullscreen Zoom Modal */}
      {modalOpen && (
        <div
          onClick={() => setModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-fade-in"
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt || "Gambar AI"}
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/10"
            />
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white hover:bg-white/20 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Pre-process streaming markdown text so incomplete raw image URLs are never shown as text */
function preprocessMarkdownForImages(rawText: string): string {
  if (!rawText) return "";

  let processed = rawText;

  // 1. Hide partial/incomplete markdown image tag during streaming
  const incompleteImageMatch = /!\[([^\]]*)\]\(((\/api\/image|https:\/\/image\.pollinations\.ai)[^\s\)]*)$/;
  if (incompleteImageMatch.test(processed)) {
    processed = processed.replace(
      incompleteImageMatch,
      "\n\n*(Sedang memproses gambar AI...)*\n\n"
    );
  }

  // 2. Hide opening image tag during streaming if URL not yet closed
  const partialTagMatch = /!\[([^\]]*)\]\($/;
  if (partialTagMatch.test(processed)) {
    processed = processed.replace(partialTagMatch, "\n\n*(Sedang memproses gambar AI...)*\n\n");
  }

  // 3. Rewrite any raw pollinations URL into internal /api/image endpoint
  const pollinationsRegex = /https:\/\/image\.pollinations\.ai\/prompt\/([^?\s\)]+)(\?[^\s\)]*)?/g;
  processed = processed.replace(pollinationsRegex, (_match, promptEncoded) => {
    return `/api/image?prompt=${promptEncoded}`;
  });

  // 4. Convert any raw image URL into markdown image tag if not enclosed
  const rawUrlRegex = /(?<![\(\[])(\/api\/image\?prompt=[^\s\)]+)/g;
  processed = processed.replace(rawUrlRegex, (url) => `![Gambar AI](${url})`);

  return processed;
}

/** Render markdown aman dengan syntax highlighting, copy code button, dan AI image card preview. */
export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
}: MarkdownRendererProps): React.JSX.Element {
  const sanitizedContent = useMemo(() => preprocessMarkdownForImages(content), [content]);

  return (
    <div className="markdown-body text-card-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: false, ignoreMissing: true }]]}
        components={{
          code({ inline, className, children, ...props }: { inline?: boolean; className?: string; children?: React.ReactNode }) {
            const match = /language-(\w+)/.exec(className || "");
            const rawCode = extractText(children).replace(/\n$/, "");

            // Inline code (single backtick `code`)
            if (inline) {
              return (
                <code
                  className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-foreground border border-border/50"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            // Block code inside <pre>
            return (
              <code
                className={cn("block whitespace-pre font-mono text-xs sm:text-sm !bg-transparent !p-0 !border-0 text-inherit", className)}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre({ children }: { children?: React.ReactNode }) {
            let language = "";
            let rawCode = "";

            if (children && typeof children === "object" && "props" in children) {
              const codeProps = (children as { props: { className?: string; children?: React.ReactNode } }).props;
              const match = /language-(\w+)/.exec(codeProps.className || "");
              language = match ? match[1] : "";
              rawCode = extractText(codeProps.children).replace(/\n$/, "");
            } else {
              rawCode = extractText(children).replace(/\n$/, "");
            }

            return (
              <ArtifactPreview language={language} rawCode={rawCode}>
                {children}
              </ArtifactPreview>
            );
          },
          img({ src, alt }: { src?: string; alt?: string }) {
            return <GeneratedImageCard src={src} alt={alt} />;
          },
          a({ href, children }: { href?: string; children?: React.ReactNode }) {
            if (href && (href.startsWith("/api/image") || href.includes("pollinations.ai"))) {
              return <GeneratedImageCard src={href} alt={extractText(children) || "Gambar AI"} />;
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {sanitizedContent}
      </ReactMarkdown>
    </div>
  );
});
