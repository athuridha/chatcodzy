"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Eye,
  Code2,
  Monitor,
  Tablet,
  Smartphone,
  Copy,
  Check,
  Download,
  ExternalLink,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sparkles,
  Terminal,
  Loader2,
} from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { cn } from "@/lib/utils/cn";

interface ArtifactPreviewProps {
  language: string;
  rawCode: string;
  children?: React.ReactNode;
}

type ViewportMode = "desktop" | "tablet" | "mobile";

/**
 * Builds a sandboxed self-contained HTML bundle for React (JSX/TSX) or plain HTML.
 */
function buildRunnerDocument(rawCode: string, language: string): string {
  const isReact =
    language === "jsx" ||
    language === "tsx" ||
    language === "react" ||
    /import\s+.*from\s+['"]react['"]|export\s+default\s+function|export\s+default\s+const|const\s+App\s*=\s*\(|function\s+App\s*\(/.test(
      rawCode
    );

  const isSvg =
    language === "svg" ||
    (/^\s*<svg/i.test(rawCode.trim()) && rawCode.trim().endsWith("</svg>"));

  if (isSvg) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #090d16;
      background-image: radial-gradient(#1e293b 1px, transparent 1px);
      background-size: 16px 16px;
      padding: 2rem;
    }
    svg { max-width: 100%; height: auto; filter: drop-shadow(0 10px 25px rgba(0,0,0,0.5)); }
  </style>
</head>
<body>
  ${rawCode}
</body>
</html>`;
  }

  if (isReact) {
    let cleanedCode = rawCode;

    // Sanitize imports for in-browser ESM
    cleanedCode = cleanedCode.replace(
      /import\s+React,\s*\{([^}]+)\}\s+from\s+['"]react['"];?/g,
      "const { $1 } = React;"
    );
    cleanedCode = cleanedCode.replace(
      /import\s+\{([^}]+)\}\s+from\s+['"]react['"];?/g,
      "const { $1 } = React;"
    );
    cleanedCode = cleanedCode.replace(
      /import\s+React\s+from\s+['"]react['"];?/g,
      ""
    );
    cleanedCode = cleanedCode.replace(
      /import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"];?/g,
      "const { $1 } = LucideIcons;"
    );
    cleanedCode = cleanedCode.replace(
      /import\s+\*\s+as\s+Lucide\s+from\s+['"]lucide-react['"];?/g,
      "const Lucide = LucideIcons;"
    );
    cleanedCode = cleanedCode.replace(
      /import\s+framerMotion\s+from\s+['"]framer-motion['"];?/g,
      ""
    );

    return `<!DOCTYPE html>
<html lang="id" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Codzy React Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: { 50: '#eff6ff', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8' }
          }
        }
      }
    }
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  
  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
  <script src="https://unpkg.com/lucide-react@latest/dist/umd/lucide-react.js"></script>
  <script src="https://unpkg.com/@babel/standalone@7.24.0/babel.min.js"></script>

  <style>
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #030712;
      color: #f3f4f6;
      min-height: 100vh;
    }
    #error-container {
      display: none;
      padding: 1.5rem;
      background: #450a0a;
      border: 1px solid #dc2626;
      border-radius: 1rem;
      margin: 1.5rem;
      color: #fecaca;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      white-space: pre-wrap;
    }
  </style>
</head>
<body class="bg-[#030712] text-slate-100 antialiased selection:bg-blue-500 selection:text-white">
  <div id="error-container"></div>
  <div id="root"></div>

  <script type="text/babel">
    window.onerror = function(msg, url, line, col, error) {
      const errBox = document.getElementById('error-container');
      if (errBox) {
        errBox.style.display = 'block';
        errBox.innerHTML = '<strong>⚠️ Runtime / Compilation Error:</strong>\\n' + msg + (line ? '\\nLine: ' + line : '');
      }
      return false;
    };

    try {
      const LucideIcons = window.LucideReact || window.lucide || {};

      ${cleanedCode}

      let RootComponent = null;
      if (typeof App !== 'undefined') {
        RootComponent = App;
      } else if (typeof Main !== 'undefined') {
        RootComponent = Main;
      } else if (typeof LandingPage !== 'undefined') {
        RootComponent = LandingPage;
      } else if (typeof Component !== 'undefined') {
        RootComponent = Component;
      } else if (typeof defaultExport !== 'undefined') {
        RootComponent = defaultExport;
      }

      if (RootComponent) {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(RootComponent));
      } else {
        const possibleKeys = Object.keys(window).filter(k => 
          typeof window[k] === 'function' && 
          /^[A-Z]/.test(k) && 
          k !== 'React' && 
          k !== 'ReactDOM' && 
          k !== 'Babel'
        );
        if (possibleKeys.length > 0 && typeof window[possibleKeys[0]] === 'function') {
          const root = ReactDOM.createRoot(document.getElementById('root'));
          root.render(React.createElement(window[possibleKeys[0]]));
        }
      }
    } catch (err) {
      const errBox = document.getElementById('error-container');
      if (errBox) {
        errBox.style.display = 'block';
        errBox.innerText = '⚠️ Error rendering React component:\\n' + err.message;
      }
    }
  </script>
</body>
</html>`;
  }

  // Pure HTML Document
  if (rawCode.includes("<html") || rawCode.includes("<!DOCTYPE") || rawCode.includes("<body")) {
    if (!rawCode.includes("cdn.tailwindcss.com")) {
      return rawCode.replace(
        "<head>",
        `<head>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>body { font-family: 'Plus Jakarta Sans', sans-serif; }</style>`
      );
    }
    return rawCode;
  }

  // HTML Snippet -> Wrap in standard boilerplate
  return `<!DOCTYPE html>
<html lang="id" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>body { font-family: 'Plus Jakarta Sans', sans-serif; }</style>
</head>
<body class="bg-slate-950 text-slate-100 antialiased min-h-screen">
  ${rawCode}
</body>
</html>`;
}

export function ArtifactPreview({
  language,
  rawCode,
  children,
}: ArtifactPreviewProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  const [viewport, setViewport] = useState<ViewportMode>("desktop");
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [debouncedDoc, setDebouncedDoc] = useState<string>("");
  const [isCompiling, setIsCompiling] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  const isExecutable = useMemo(() => {
    const lang = (language || "").toLowerCase();
    return (
      lang === "html" ||
      lang === "jsx" ||
      lang === "tsx" ||
      lang === "react" ||
      lang === "svg" ||
      /<!DOCTYPE html|<html|<body|<div|<section|import\s+React|export\s+default\s+function|<svg/i.test(
        rawCode
      )
    );
  }, [language, rawCode]);

  // Debounce the iframe build so the browser doesn't lock or freeze while AI is streaming tokens
  useEffect(() => {
    if (!isExecutable) return;

    setIsCompiling(true);
    const timer = setTimeout(() => {
      setDebouncedDoc(buildRunnerDocument(rawCode, language));
      setIsCompiling(false);
    }, 450);

    return () => clearTimeout(timer);
  }, [rawCode, language, isExecutable]);

  const badgeLabel = useMemo(() => {
    const lang = (language || "").toLowerCase();
    if (lang === "jsx" || lang === "tsx" || lang === "react") return "React UI Component";
    if (lang === "svg") return "Vector SVG";
    return "HTML5 / Tailwind App";
  }, [language]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(rawCode);
      setCopied(true);
      toast("success", "Source code berhasil disalin.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("error", "Gagal menyalin kode.");
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const isReact = language === "jsx" || language === "tsx" || language === "react";
    const isSvg = language === "svg";
    const ext = isReact ? "jsx" : isSvg ? "svg" : "html";
    const blob = new Blob([isReact ? rawCode : debouncedDoc || rawCode], {
      type: isReact ? "text/javascript" : isSvg ? "image/svg+xml" : "text/html",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `codzy-app-${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast("success", `File .${ext} berhasil diunduh.`);
  };

  const handleOpenNewTab = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const blob = new Blob([debouncedDoc || rawCode], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const handleReload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setReloadKey((prev) => prev + 1);
    toast("info", "Memuat ulang preview...");
  };

  // If not executable code, render standard syntax-highlighted code block
  if (!isExecutable) {
    return (
      <div className="relative my-3 overflow-hidden rounded-2xl border border-border/80 bg-[#0d1117] text-gray-100 shadow-md">
        <div className="flex h-9 items-center justify-between border-b border-white/10 bg-neutral-900/90 px-3.5 select-none">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-semibold text-gray-300 lowercase">{language || "code"}</span>
          </div>
          <button
            onClick={handleCopy}
            type="button"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-gray-400 hover:bg-neutral-800 hover:text-white transition-all active:scale-95 cursor-pointer"
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
        <div className="overflow-x-auto p-4 font-mono text-xs sm:text-sm leading-relaxed text-[#c9d1d9]">
          {children}
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "my-4 overflow-hidden rounded-2xl border border-border/80 bg-[#090d16] shadow-2xl transition-all duration-300 relative z-10",
          isFullscreen ? "fixed inset-4 z-50 flex flex-col my-0 shadow-2xl backdrop-blur-xl border-blue-500/30" : ""
        )}
      >
        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-neutral-900/95 px-3.5 py-2.5 backdrop-blur-md select-none">
          {/* Left: View Tabs & Type Badge */}
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-neutral-950 p-1 border border-white/5 shadow-inner">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveTab("preview");
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all duration-200 cursor-pointer",
                  activeTab === "preview"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Live Preview</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveTab("code");
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all duration-200 cursor-pointer",
                  activeTab === "code"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                <Code2 className="h-3.5 w-3.5" />
                <span>Code</span>
              </button>
            </div>

            <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold font-mono text-blue-400 border border-blue-500/20">
              <Sparkles className="h-2.5 w-2.5" />
              {badgeLabel}
            </span>

            {isCompiling && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md animate-pulse">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                Streaming...
              </span>
            )}
          </div>

          {/* Right: Viewport Controls & Actions */}
          <div className="flex items-center gap-1.5">
            {activeTab === "preview" && (
              <div className="flex items-center rounded-xl bg-neutral-950 p-0.5 border border-white/5 mr-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setViewport("desktop");
                  }}
                  title="Tampilan Desktop (100%)"
                  className={cn(
                    "p-1.5 rounded-lg transition-colors cursor-pointer",
                    viewport === "desktop" ? "bg-neutral-800 text-blue-400" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  <Monitor className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setViewport("tablet");
                  }}
                  title="Tampilan Tablet (768px)"
                  className={cn(
                    "p-1.5 rounded-lg transition-colors cursor-pointer",
                    viewport === "tablet" ? "bg-neutral-800 text-blue-400" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  <Tablet className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setViewport("mobile");
                  }}
                  title="Tampilan Smartphone (375px)"
                  className={cn(
                    "p-1.5 rounded-lg transition-colors cursor-pointer",
                    viewport === "mobile" ? "bg-neutral-800 text-blue-400" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {activeTab === "preview" && (
              <button
                type="button"
                onClick={handleReload}
                title="Muat Ulang Preview"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenNewTab}
              title="Buka di Tab Baru"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={handleDownload}
              title="Download Berkas"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={handleCopy}
              title="Salin Source Code"
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-[10px] text-emerald-400 font-medium hidden sm:inline">Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span className="text-[10px] hidden sm:inline">Salin</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsFullscreen(!isFullscreen);
              }}
              title={isFullscreen ? "Kecilkan" : "Perbesar Fullscreen"}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-neutral-800 hover:text-white transition-colors ml-0.5 cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Content Area */}
        {activeTab === "preview" ? (
          <div
            className={cn(
              "flex flex-1 justify-center bg-[#070a12] p-3 sm:p-4 overflow-hidden transition-all",
              isFullscreen ? "h-[calc(100%-48px)]" : "min-h-[460px] h-[520px]"
            )}
          >
            <div
              className={cn(
                "h-full w-full overflow-hidden rounded-xl border border-white/10 bg-[#030712] shadow-2xl transition-all duration-300 relative",
                viewport === "mobile"
                  ? "max-w-[375px] rounded-3xl border-2 border-slate-700 shadow-[0_0_50px_rgba(0,0,0,0.8)]"
                  : viewport === "tablet"
                  ? "max-w-[768px]"
                  : "max-w-full"
              )}
            >
              {debouncedDoc ? (
                <iframe
                  key={reloadKey}
                  ref={iframeRef}
                  srcDoc={debouncedDoc}
                  title="Codzy Live Preview"
                  sandbox="allow-scripts allow-modals allow-same-origin allow-forms"
                  className="h-full w-full border-0 bg-transparent"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center text-slate-400">
                  <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-200">Sedang menyusun kode aplikasi...</p>
                    <p className="text-xs text-slate-500">Klik tab <strong>Code</strong> di atas untuk melihat kode secara langsung.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "overflow-auto p-4 font-mono text-xs sm:text-sm leading-relaxed text-[#c9d1d9] bg-[#0d1117]",
              isFullscreen ? "h-[calc(100%-48px)]" : "max-h-[500px]"
            )}
          >
            {children}
          </div>
        )}
      </div>

      {/* Backdrop overlay for fullscreen modal */}
      {isFullscreen && (
        <div
          onClick={() => setIsFullscreen(false)}
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md animate-fade-in"
        />
      )}
    </>
  );
}
