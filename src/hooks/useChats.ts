"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchUserChats } from "@/lib/firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import type { Chat } from "@/types/chat";

interface UseChatsResult {
  chats: Chat[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/** Hook daftar chat user (exclude soft-deleted), sorted updatedAt desc. */
export function useChats(): UseChatsResult {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user) {
      setChats([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    fetchUserChats(user.uid)
      .then((result) => {
        if (!active) return;
        setChats(result);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        console.error("useChats:", err);
        setError(err instanceof Error ? err.message : "Gagal memuat riwayat");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return { chats, loading, error, refresh };
}
