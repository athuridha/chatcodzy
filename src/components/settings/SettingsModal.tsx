"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Settings,
  User,
  HardDrive,
  Shield,
  Sun,
  Moon,
  Monitor,
  LogOut,
  Loader2,
  Search,
} from "lucide-react";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";

import { StorageManager } from "./StorageManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/contexts/ToastContext";
import { db } from "@/lib/firebase/client";
import { logout } from "@/lib/firebase/auth";
import type { ThemePreference, UserProfileDoc } from "@/types/user";
import { cn } from "@/lib/utils/cn";

export type SettingsTab = "general" | "personalization" | "storage" | "account";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
}

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  icon: React.ReactNode;
}> = [
  { value: "light", label: "Terang", icon: <Sun className="h-4 w-4" /> },
  { value: "dark", label: "Gelap", icon: <Moon className="h-4 w-4" /> },
  { value: "system", label: "Sistem", icon: <Monitor className="h-4 w-4" /> },
];

export function SettingsModal({
  isOpen,
  onClose,
  initialTab = "general",
}: SettingsModalProps): React.JSX.Element | null {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  // Load profile from Firestore
  useEffect(() => {
    if (!user) return;
    let active = true;

    setDisplayName(user.displayName ?? "");
    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        if (!active) return;
        const data = snap.data() as UserProfileDoc | undefined;
        if (data?.theme && ["light", "dark", "system"].includes(data.theme)) {
          setTheme(data.theme as ThemePreference);
        }
        setLoadingProfile(false);
      })
      .catch(() => {
        if (active) setLoadingProfile(false);
      });

    return () => {
      active = false;
    };
  }, [user, setTheme]);

  const handleSaveName = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!user || savingName) return;

    const name = displayName.trim();
    if (!name) {
      toast("error", "Nama tidak boleh kosong.");
      return;
    }

    setSavingName(true);
    try {
      const { updateProfile } = await import("firebase/auth");
      await updateProfile(user, { displayName: name });
      await updateDoc(doc(db, "users", user.uid), {
        displayName: name,
        updatedAt: serverTimestamp(),
      });
      toast("success", "Nama berhasil diperbarui.");
    } catch {
      toast("error", "Gagal menyimpan nama. Coba lagi.");
    } finally {
      setSavingName(false);
    }
  };

  const handleChangeTheme = async (next: ThemePreference): Promise<void> => {
    setTheme(next);
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        theme: next,
        updatedAt: serverTimestamp(),
      });
    } catch {
      /* ignore */
    }
  };

  const handleLogout = async (): Promise<void> => {
    await logout();
    onClose();
    router.replace("/login");
  };

  if (!isOpen) return null;

  const NAV_ITEMS: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
    { id: "general", label: "Umum", icon: <Settings className="h-4 w-4" /> },
    { id: "personalization", label: "Personalisasi", icon: <User className="h-4 w-4" /> },
    { id: "storage", label: "Penyimpanan", icon: <HardDrive className="h-4 w-4" /> },
    { id: "account", label: "Akun & Keamanan", icon: <Shield className="h-4 w-4" /> },
  ];

  const filteredNavItems = NAV_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-6 backdrop-blur-xs animate-fade-in">
      <div className="flex h-[560px] w-full max-w-3xl flex-col md:flex-row overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl">
        {/* Left Sidebar Menu */}
        <div className="flex w-full md:w-60 flex-col border-b md:border-b-0 md:border-r border-border/80 bg-background/50 p-4 shrink-0">
          {/* Header Close button & Search */}
          <div className="space-y-3 pb-3">
            <div className="flex items-center justify-between">
              <button
                onClick={onClose}
                title="Tutup Pengaturan"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Pengaturan
              </span>
            </div>

            {/* Search Settings */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Cari pengaturan"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-full rounded-lg border border-border/80 bg-background/80 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30"
              />
            </div>
          </div>

          {/* Nav List */}
          <nav className="flex-1 space-y-1 overflow-y-auto py-1">
            {filteredNavItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-all text-left",
                    active
                      ? "bg-accent text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          {/* 1. UMUM / GENERAL */}
          {activeTab === "general" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Umum</h2>
                <p className="text-xs text-muted-foreground">
                  Kelola preferensi antarmuka dan tema tampilan aplikasi.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <label className="text-xs font-semibold text-foreground">Tema Tampilan</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {THEME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => void handleChangeTheme(opt.value)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-xl border p-3.5 text-xs transition-all active:scale-[0.98]",
                        theme === opt.value
                          ? "border-foreground bg-accent text-foreground font-semibold shadow-xs"
                          : "border-border/80 bg-background/50 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                      )}
                    >
                      {opt.icon}
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2. PERSONALISASI */}
          {activeTab === "personalization" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Personalisasi</h2>
                <p className="text-xs text-muted-foreground">
                  Sesuaikan bagaimana profil dan nama Anda ditampilkan.
                </p>
              </div>

              <form onSubmit={handleSaveName} className="space-y-3 pt-2">
                <label htmlFor="modalDisplayName" className="text-xs font-semibold text-foreground">
                  Nama Tampilan
                </label>
                {loadingProfile ? (
                  <Skeleton className="h-10 w-full rounded-xl" />
                ) : (
                  <div className="flex gap-2">
                    <Input
                      id="modalDisplayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={60}
                      className="rounded-xl"
                    />
                    <Button type="submit" disabled={savingName} className="rounded-xl">
                      {savingName && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                      Simpan
                    </Button>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* 3. PENYIMPANAN (STORAGE TAB) */}
          {activeTab === "storage" && <StorageManager />}

          {/* 4. AKUN & KEAMANAN */}
          {activeTab === "account" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Akun & Keamanan</h2>
                <p className="text-xs text-muted-foreground">
                  Kelola sesi login dan data autentikasi akun Anda.
                </p>
              </div>

              <div className="rounded-xl border border-border/80 bg-background/50 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {user?.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.photoURL}
                      alt=""
                      className="h-12 w-12 rounded-full object-cover border border-border"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
                      {(user?.displayName ?? "U").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="block truncate font-bold text-sm text-foreground">
                      {user?.displayName || "Pengguna"}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {user?.email || "Akun Terdaftar"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border/60">
                <Button
                  variant="destructive"
                  onClick={() => void handleLogout()}
                  className="w-full rounded-xl"
                >
                  <LogOut className="h-4 w-4 mr-2" /> Keluar dari Akun
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
