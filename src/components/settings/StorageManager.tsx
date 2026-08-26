"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  ImageIcon,
  Trash2,
  ChevronRight,
  ArrowLeft,
  Download,
  ExternalLink,
  Loader2,
  HardDrive,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  deleteUserFile,
  fetchUserFiles,
  USER_MAX_STORAGE_BYTES,
  type StoredUserFile,
} from "@/lib/firebase/firestore";
import { Button } from "@/components/ui/button";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function StorageManager(): React.JSX.Element {
  const { user } = useAuth();
  const { toast } = useToast();

  const [files, setFiles] = useState<StoredUserFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<"none" | "file" | "image">("none");

  const loadFiles = () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchUserFiles(user.uid)
      .then((data) => {
        setFiles(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("fetchUserFiles error:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadFiles();
  }, [user]);

  const { totalUsed, fileList, imageList, fileBytes, imageBytes } = useMemo(() => {
    let total = 0;
    let fBytes = 0;
    let iBytes = 0;
    const fList: StoredUserFile[] = [];
    const iList: StoredUserFile[] = [];

    files.forEach((f) => {
      total += f.size;
      if (f.type === "image") {
        iBytes += f.size;
        iList.push(f);
      } else {
        fBytes += f.size;
        fList.push(f);
      }
    });

    return {
      totalUsed: total,
      fileList: fList,
      imageList: iList,
      fileBytes: fBytes,
      imageBytes: iBytes,
    };
  }, [files]);

  const usedMB = (totalUsed / (1024 * 1024)).toFixed(2);
  const percentUsed = Math.min(100, (totalUsed / USER_MAX_STORAGE_BYTES) * 100);

  const handleDelete = async (file: StoredUserFile) => {
    if (!user || deletingId) return;
    setDeletingId(file.id);

    try {
      await deleteUserFile(user.uid, file.id, file.size, file.type);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      toast("success", `"${file.name}" berhasil dihapus.`);
    } catch {
      toast("error", "Gagal menghapus file.");
    } finally {
      setDeletingId(null);
    }
  };

  // CATEGORY DETAIL VIEW (Drilldown into File / Gambar list)
  if (activeCategory !== "none") {
    const listToDisplay = activeCategory === "image" ? imageList : fileList;
    const categoryTitle = activeCategory === "image" ? "Gambar" : "File & Dokumen";

    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <button
            onClick={() => setActiveCategory("none")}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Penyimpanan</span>
          </button>
          <span className="text-xs text-muted-foreground">
            {listToDisplay.length} item • {formatBytes(activeCategory === "image" ? imageBytes : fileBytes)}
          </span>
        </div>

        <div>
          <h3 className="text-base font-bold text-foreground">{categoryTitle}</h3>
          <p className="text-xs text-muted-foreground">
            Pilih file untuk diunduh atau hapus untuk mengosongkan ruang penyimpanan Anda.
          </p>
        </div>

        {listToDisplay.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground">
            <HardDrive className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-xs font-medium">Belum ada {categoryTitle.toLowerCase()} yang tersimpan.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {listToDisplay.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-xl border border-border/80 bg-background/60 p-2.5 hover:bg-accent/40 transition-all gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {f.type === "image" && f.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={f.url}
                      alt={f.name}
                      className="h-10 w-10 rounded-lg object-cover border border-border shrink-0"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-foreground">
                      {f.name}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {formatBytes(f.size)} • {f.createdAt.toLocaleDateString("id-ID")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {f.url && (
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Buka / Unduh"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}

                  <button
                    onClick={() => handleDelete(f)}
                    disabled={deletingId === f.id}
                    title="Hapus file ini"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                  >
                    {deletingId === f.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // MAIN STORAGE OVERVIEW (Exactly matching ChatGPT screenshot)
  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-foreground">Penyimpanan</h2>
      </div>

      {/* Usage Bar */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs font-medium text-foreground">
          <span>
            <strong className="font-bold">{usedMB} MB</strong> dari 512 MB terpakai
          </span>
          <span className="text-[11px] text-muted-foreground">
            Maks. 100 MB / upload
          </span>
        </div>

        {/* Custom Progress Bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-foreground transition-all duration-500"
            style={{ width: `${Math.max(2, percentUsed)}%` }}
          />
        </div>
      </div>

      {/* Storage Management Section */}
      <div className="space-y-3 pt-2">
        <div>
          <h3 className="text-sm font-bold text-foreground">Kelola penyimpanan</h3>
          <p className="text-xs text-muted-foreground">
            Kelola pustaka Anda untuk mengosongkan ruang penyimpanan
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="divide-y divide-border/60 rounded-xl border border-border/80 bg-background/50 overflow-hidden">
            {/* File Row */}
            <button
              onClick={() => setActiveCategory("file")}
              className="flex w-full items-center justify-between p-3.5 text-left hover:bg-accent/40 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:text-foreground transition-colors">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <span className="block text-xs font-semibold text-foreground">File & Dokumen</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {formatBytes(fileBytes)} • {fileList.length} file
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-transform group-hover:translate-x-0.5" />
            </button>

            {/* Gambar Row */}
            <button
              onClick={() => setActiveCategory("image")}
              className="flex w-full items-center justify-between p-3.5 text-left hover:bg-accent/40 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:text-foreground transition-colors">
                  <ImageIcon className="h-4 w-4" />
                </div>
                <div>
                  <span className="block text-xs font-semibold text-foreground">Gambar</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {formatBytes(imageBytes)} • {imageList.length} gambar
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
