"use client";

import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy, Terminal } from "lucide-react";
import "highlight.js/styles/github-dark.css";

import { useToast } from "@/contexts/ToastContext";
import { cn } from "@/lib/utils/cn";

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

/** Render markdown aman dengan syntax highlighting dan copy code button yang rapi. */
export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
}: MarkdownRendererProps): React.JSX.Element {
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
              <CodeBlockHeader language={language} rawCode={rawCode}>
                {children}
              </CodeBlockHeader>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
