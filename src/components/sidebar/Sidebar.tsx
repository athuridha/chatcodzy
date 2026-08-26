"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Search,
  MessageSquare,
  MoreVertical,
  Pencil,
  Trash2,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  LogIn,
  User,
  SlidersHorizontal,
  LifeBuoy,
  LogOut,
  ChevronRight,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsModal, type SettingsTab } from "@/components/settings/SettingsModal";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useChats } from "@/hooks/useChats";
import { CHATS_CHANGED_EVENT } from "@/components/chat/ChatView";
import { softDeleteChat, renameChat } from "@/lib/firebase/firestore";
import { logout } from "@/lib/firebase/auth";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils/cn";
import type { Chat } from "@/types/chat";

interface SidebarProps {
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
  collapsed?: boolean;
}

function getChatDateCategory(date: Date): "Today" | "Previous 7 Days" | "Previous 30 Days" | "Older" {
  const now = new Date();
  const d = new Date(date);
  
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  
  const isToday =
    now.getDate() === d.getDate() &&
    now.getMonth() === d.getMonth() &&
    now.getFullYear() === d.getFullYear();

  if (isToday || diffDays === 0) return "Today";
  if (diffDays <= 7) return "Previous 7 Days";
  if (diffDays <= 30) return "Previous 30 Days";
  return "Older";
}

function formatChatTime(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0 && now.getDate() === d.getDate()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1 || (diffDays === 0 && now.getDate() !== d.getDate())) {
    return "Yesterday";
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getUserInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return "US";
}

export function Sidebar({ onNavigate, onToggleCollapse, collapsed = false }: SidebarProps): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const { chats, loading, error, refresh } = useChats();

  const [search, setSearch] = useState("");
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");

  const searchInputRef = useRef<HTMLInputElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    if (showProfileMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showProfileMenu]);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Listen for realtime chat updates
  useEffect(() => {
    const handleChatsChanged = () => {
      refresh();
    };
    window.addEventListener(CHATS_CHANGED_EVENT, handleChatsChanged);
    return () => window.removeEventListener(CHATS_CHANGED_EVENT, handleChatsChanged);
  }, [refresh]);

  const filteredChats = useMemo(() => {
    if (!search.trim()) return chats;
    const q = search.toLowerCase();
    return chats.filter((c) => c.title.toLowerCase().includes(q));
  }, [chats, search]);

  const groupedChats = useMemo(() => {
    const groups: Record<"Today" | "Previous 7 Days" | "Previous 30 Days" | "Older", Chat[]> = {
      Today: [],
      "Previous 7 Days": [],
      "Previous 30 Days": [],
      Older: [],
    };

    filteredChats.forEach((chat) => {
      const cat = getChatDateCategory(chat.updatedAt);
      groups[cat].push(chat);
    });

    return groups;
  }, [filteredChats]);

  const handleDelete = async (e: React.MouseEvent, chatId: string): Promise<void> => {
    e.preventDefault();
    e.stopPropagation();
    if (deletingId) return;

    setDeletingId(chatId);
    setMenuOpenFor(null);
    try {
      await softDeleteChat(chatId);
      refresh();
      toast("info", "Percakapan telah dihapus.");
      if (pathname === `/chat/${chatId}`) {
        router.push("/chat");
      }
    } catch {
      toast("error", "Gagal menghapus percakapan.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleRename = async (e: React.MouseEvent, chat: Chat): Promise<void> => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpenFor(null);

    const newTitle = window.prompt("Ubah judul percakapan:", chat.title);
    if (!newTitle || newTitle.trim() === chat.title) return;

    try {
      await renameChat(chat.chatId, newTitle.trim());
      refresh();
      toast("success", "Judul percakapan diperbarui.");
    } catch {
      toast("error", "Gagal mengubah judul percakapan.");
    }
  };

  const handleLogout = async (): Promise<void> => {
    setShowProfileMenu(false);
    await logout();
    router.replace("/login");
  };

  const openSettings = (tab: SettingsTab) => {
    setShowProfileMenu(false);
    setSettingsTab(tab);
    setSettingsModalOpen(true);
  };

  // ----------------------------------------------------
  // MINIFIED RAIL VIEW (when collapsed = true)
  // ----------------------------------------------------
  if (collapsed) {
    return (
      <div className="flex h-full w-[60px] flex-col items-center justify-between border-r border-border bg-card py-3 transition-all duration-300">
        <div className="flex flex-col items-center gap-3 w-full px-2">
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title="Buka Sidebar"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-all active:scale-95"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}

          <Link
            href="/chat"
            onClick={() => onNavigate?.()}
            title="Chat Baru"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm hover:opacity-90 transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" />
          </Link>
        </div>

        {/* Bottom Profile in Mini Rail */}
        <div className="flex flex-col items-center gap-2.5 w-full px-2 pt-2">
          {user ? (
            <button
              onClick={() => openSettings("storage")}
              title="Buka Pengaturan & Penyimpanan"
              className="transition-transform active:scale-95"
            >
              {user?.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.photoURL}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover border border-border"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#10a37f] text-white text-[11px] font-bold">
                  {getUserInitials(user?.displayName, user?.email)}
                </div>
              )}
            </button>
          ) : (
            <Link
              href="/login"
              onClick={() => onNavigate?.()}
              title="Masuk Akun"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs transition-all active:scale-95"
            >
              <LogIn className="h-4 w-4" />
            </Link>
          )}
        </div>

        <SettingsModal
          isOpen={settingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          initialTab={settingsTab}
        />
      </div>
    );
  }

  // ----------------------------------------------------
  // FULL SIDEBAR VIEW
  // ----------------------------------------------------
  return (
    <div className="flex h-full w-full flex-col border-r border-border/80 bg-card transition-all duration-300 select-none relative">
      {/* Header with App Logo & Collapse Toggle */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-border/60">
        <Link
          href="/chat"
          onClick={() => onNavigate?.()}
          className="flex items-center font-bold tracking-tight text-foreground hover:opacity-90 transition-opacity"
        >
          <span className="text-sm font-bold uppercase tracking-wider">{APP_NAME}</span>
        </Link>

        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title="Tutup Sidebar"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-all active:scale-95"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Action: New Chat Button */}
      <div className="p-3 pb-2 space-y-2">
        <Link
          href="/chat"
          onClick={() => onNavigate?.()}
          className="flex w-full items-center justify-center gap-2 h-9 rounded-xl font-medium border border-border/90 bg-background/80 hover:bg-accent/80 transition-all shadow-xs active:scale-[0.98] text-foreground text-xs"
        >
          <Plus className="h-4 w-4" />
          <span>New Chat</span>
        </Link>

        {/* Search Input Box */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            placeholder="Cari percakapan.."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 pr-7 text-xs bg-background/50 border-border/70 rounded-lg placeholder:text-muted-foreground/70 focus:bg-background focus:ring-1 focus:ring-foreground/20"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Chat History Grouped List */}
      <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-4">
        {loading ? (
          <div className="space-y-2 px-2 py-1">
            <Skeleton className="h-7 w-full rounded-lg" />
            <Skeleton className="h-7 w-3/4 rounded-lg" />
            <Skeleton className="h-7 w-5/6 rounded-lg" />
          </div>
        ) : error ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            Gagal memuat riwayat.
          </p>
        ) : filteredChats.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            {search ? "Tidak ada hasil percakapan." : "Belum ada obrolan."}
          </div>
        ) : (
          (Object.keys(groupedChats) as Array<keyof typeof groupedChats>).map((groupKey) => {
            const list = groupedChats[groupKey];
            if (list.length === 0) return null;

            return (
              <div key={groupKey} className="space-y-1">
                <span className="px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {groupKey}
                </span>

                <div className="space-y-0.5 pt-0.5">
                  {list.map((chat) => {
                    const isActive = pathname === `/chat/${chat.chatId}`;
                    const isMenuOpen = menuOpenFor === chat.chatId;

                    return (
                      <div
                        key={chat.chatId}
                        className={cn(
                          "group relative flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition-all",
                          isActive
                            ? "bg-accent font-medium text-accent-foreground shadow-xs"
                            : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                        )}
                      >
                        <Link
                          href={`/chat/${chat.chatId}`}
                          onClick={() => onNavigate?.()}
                          className="flex items-center gap-2 min-w-0 flex-1 py-0.5"
                        >
                          <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-xs">
                              {chat.title}
                            </span>
                            <span className="block truncate text-[10px] text-muted-foreground/60">
                              {chat.title}
                            </span>
                          </div>
                        </Link>

                        {/* Right: Timestamp or 3-dots Menu button */}
                        <div className="relative shrink-0 flex items-center">
                          <span className="text-[10px] text-muted-foreground/60 group-hover:hidden pl-1">
                            {formatChatTime(chat.updatedAt)}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setMenuOpenFor(isMenuOpen ? null : chat.chatId);
                            }}
                            className={cn(
                              "h-6 w-6 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all",
                              isMenuOpen ? "flex" : "hidden group-hover:flex"
                            )}
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>

                          {/* Popover Action Menu */}
                          {isMenuOpen && (
                            <div className="absolute right-0 top-7 z-50 w-36 rounded-xl border border-border bg-card p-1 shadow-lg backdrop-blur-md animate-fade-in">
                              <button
                                type="button"
                                onClick={(e) => void handleRename(e, chat)}
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
                              >
                                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>Ubah Nama</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => void handleDelete(e, chat.chatId)}
                                disabled={deletingId === chat.chatId}
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Hapus Chat</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </nav>

      {/* Bottom Profile Section with ChatGPT-style Popup Menu */}
      <div className="p-2 relative" ref={profileMenuRef}>
        {/* ChatGPT Style Floating Menu */}
        {showProfileMenu && user && (
          <div className="absolute bottom-[58px] left-2 right-2 z-50 rounded-2xl border border-border/80 bg-[#1e1e1e] p-1.5 shadow-2xl backdrop-blur-md text-gray-200 animate-fade-in divide-y divide-white/10">
            {/* Header User Details */}
            <div
              onClick={() => openSettings("personalization")}
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {user.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.photoURL}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover border border-white/20"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#10a37f] text-white text-xs font-bold shrink-0">
                    {getUserInitials(user.displayName, user.email)}
                  </div>
                )}
                <div className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-white">
                    {user.displayName || "Pengguna"}
                  </span>
                  <span className="block text-[10px] text-gray-400">Free</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </div>

            {/* Main Action Items */}
            <div className="py-1 space-y-0.5">
              <button
                type="button"
                onClick={() => openSettings("personalization")}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <SlidersHorizontal className="h-4 w-4 text-gray-400" />
                <span>Personalisasi</span>
              </button>

              <button
                type="button"
                onClick={() => openSettings("personalization")}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <User className="h-4 w-4 text-gray-400" />
                <span>Profil</span>
              </button>

              <button
                type="button"
                onClick={() => openSettings("storage")}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <Settings className="h-4 w-4 text-gray-400" />
                <span>Pengaturan</span>
              </button>
            </div>

            {/* Logout */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Keluar</span>
              </button>
            </div>
          </div>
        )}

        {/* Bottom Profile Trigger Bar */}
        {user ? (
          <div
            onClick={() => setShowProfileMenu((prev) => !prev)}
            className="flex items-center justify-between rounded-xl px-2.5 py-2 hover:bg-accent/50 cursor-pointer transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {user.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.photoURL}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover border border-border shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#10a37f] text-white text-xs font-bold shrink-0 shadow-xs">
                  {getUserInitials(user.displayName, user.email)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-foreground">
                  {user.displayName || "Pengguna"}
                </span>
                <span className="block text-[10px] text-muted-foreground">Free</span>
              </div>
            </div>

            <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", showProfileMenu ? "rotate-90" : "")} />
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-2xl border border-border/80 bg-background/80 p-2.5 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground text-xs font-semibold">
                <User className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-foreground">
                  Tamu
                </span>
              </div>
            </div>

            <Link
              href="/login"
              onClick={() => onNavigate?.()}
              className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 transition-all shrink-0"
            >
              <LogIn className="h-3 w-3" />
              <span>Masuk</span>
            </Link>
          </div>
        )}
      </div>

      {/* Global Settings & Storage Modal */}
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        initialTab={settingsTab}
      />
    </div>
  );
}
