import JSZip from "jszip";

const IGNORED_PATTERNS = [
  "node_modules/",
  ".git/",
  "__pycache__/",
  ".next/",
  ".vscode/",
  ".idea/",
  "dist/",
  "build/",
  ".DS_Store",
  "Thumbs.db",
];

const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "ico", "svg",
  "pdf", "exe", "dll", "so", "dylib", "bin",
  "zip", "tar", "gz", "7z", "rar",
  "pyc", "class", "o", "obj",
  "mp3", "mp4", "wav", "avi", "mov",
  "woff", "woff2", "ttf", "eot",
]);

const MAX_FILE_SIZE_BYTES = 80 * 1024; // 80KB per file
const MAX_TOTAL_FILES = 60; // Max 60 files extracted

function isBinary(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return false;
  return BINARY_EXTENSIONS.has(ext);
}

function getLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "javascript";
    case "ts":
    case "tsx":
      return "typescript";
    case "py":
      return "python";
    case "html":
    case "htm":
      return "html";
    case "css":
    case "scss":
    case "sass":
      return "css";
    case "json":
      return "json";
    case "md":
    case "markdown":
      return "markdown";
    case "sql":
      return "sql";
    case "sh":
    case "bash":
      return "bash";
    case "yml":
    case "yaml":
      return "yaml";
    case "java":
      return "java";
    case "c":
    case "h":
      return "c";
    case "cpp":
    case "hpp":
      return "cpp";
    case "rs":
      return "rust";
    case "go":
      return "go";
    case "php":
      return "php";
    default:
      return ext || "text";
  }
}

export interface UnpackedZipResult {
  fileCount: number;
  totalSizeBytes: number;
  formattedContent: string;
}

/** Unpack a zip archive in the browser and extract all code/text files into structured markdown */
export async function unpackZipFile(file: File): Promise<UnpackedZipResult> {
  const zip = new JSZip();
  const loaded = await zip.loadAsync(file);

  const fileEntries: Array<{ path: string; content: string; size: number }> = [];
  let totalBytes = 0;

  const entries = Object.keys(loaded.files);

  for (const relativePath of entries) {
    if (fileEntries.length >= MAX_TOTAL_FILES) break;

    const entry = loaded.files[relativePath];
    if (entry.dir) continue;

    // Skip ignored directories and binary files
    if (IGNORED_PATTERNS.some((p) => relativePath.includes(p))) continue;
    if (isBinary(relativePath)) continue;

    try {
      let content = await entry.async("string");
      if (content.length > MAX_FILE_SIZE_BYTES) {
        content = `${content.slice(0, MAX_FILE_SIZE_BYTES)}\n\n[...Konten file terpotong karena melebihi batas...]`;
      }
      fileEntries.push({
        path: relativePath,
        content,
        size: content.length,
      });
      totalBytes += content.length;
    } catch {
      // skip unreadable files
    }
  }

  if (fileEntries.length === 0) {
    return {
      fileCount: 0,
      totalSizeBytes: 0,
      formattedContent: `--- [Arsip ZIP: ${file.name}] ---\n(Tidak ada file teks atau kode yang dapat dibaca di dalam arsip ini)\n--- [Akhir Arsip] ---`,
    };
  }

  // Structure into clean markdown codeblocks for the AI
  const sections = fileEntries.map((f) => {
    const lang = getLanguage(f.path);
    return `### 📄 File: \`${f.path}\`\n\`\`\`${lang}\n${f.content}\n\`\`\``;
  });

  const formatted = [
    `--- [Arsip Project ZIP: ${file.name} (${fileEntries.length} file diekstrak)] ---`,
    `Daftar File:`,
    fileEntries.map((f) => `- \`${f.path}\` (${(f.size / 1024).toFixed(1)} KB)`).join("\n"),
    `\nIsi Konten File:`,
    sections.join("\n\n"),
    `--- [Akhir Arsip ${file.name}] ---`,
  ].join("\n\n");

  return {
    fileCount: fileEntries.length,
    totalSizeBytes: totalBytes,
    formattedContent: formatted,
  };
}
