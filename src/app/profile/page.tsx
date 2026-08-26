"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import {
  ArrowLeft,
  HardDrive,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Shield,
  Sun,
  User,
} from "lucide-react";

import { AppShell } from "@/components/shared/AppShell";
import { StorageManager } from "@/components/settings/StorageManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useTheme } from "@/contexts/ThemeContext";
import { db } from "@/lib/firebase/client";
import { logout } from "@/lib/firebase/auth";
import type { ThemePreference, UserProfileDoc } from "@/types/user";
import { cn } from "@/lib/utils/cn";

export type SettingsTab = "general" | "personalization" | "storage" | "account";

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  icon: React.ReactNode;
}> = [
  { value: "light", label: "Terang", icon: <Sun className="h-4 w-4" /> },
  { value: "dark", label: "Gelap", icon: <Moon className="h-4 w-4" /> },
  { value: "system", label: "Sistem", icon: <Monitor className="h-4 w-4" /> },
];

function ProfileView(): React.JSX.Element {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Muat profil dari Firestore users/{uid}
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
    router.replace("/login");
  };

  const NAV_ITEMS: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
    { id: "general", label: "Umum", icon: <Settings className="h-4 w-4" /> },
    { id: "personalization", label: "Personalisasi", icon: <User className="h-4 w-4" /> },
    { id: "storage", label: "Penyimpanan", icon: <HardDrive className="h-4 w-4" /> },
    { id: "account", label: "Akun & Keamanan", icon: <Shield className="h-4 w-4" /> },
  ];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 md:py-8">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/80 pb-4">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Kembali"
          onClick={() => router.push("/chat")}
          className="rounded-xl"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Pengaturan</h1>
          <p className="text-xs text-muted-foreground">Kelola akun, preferensi tema, dan kapasitas penyimpanan.</p>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex flex-col md:flex-row rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm min-h-[500px]">
        {/* Left Tab List */}
        <div className="w-full md:w-56 border-b md:border-b-0 md:border-r border-border/80 bg-background/50 p-3 space-y-1 shrink-0">
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-all text-left",
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
        </div>

        {/* Right Content Panel */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto">
          {/* 1. UMUM */}
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
                  Sesuaikan bagaimana nama Anda ditampilkan di chat.
                </p>
              </div>

              <form onSubmit={handleSaveName} className="space-y-3 pt-2">
                <label htmlFor="displayName" className="text-xs font-semibold text-foreground">
                  Nama Tampilan
                </label>
                {loadingProfile ? (
                  <Skeleton className="h-10 w-full rounded-xl" />
                ) : (
                  <div className="flex gap-2">
                    <Input
                      id="displayName"
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

          {/* 3. PENYIMPANAN (512 MB QUOTA & FILE MANAGER) */}
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

export default function ProfilePage(): React.JSX.Element {
  return (
    <AppShell>
      <div className="overflow-y-auto">
        <ProfileView />
      </div>
    </AppShell>
  );
}
