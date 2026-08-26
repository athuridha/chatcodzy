"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { User as FirebaseUser } from "firebase/auth";

import { auth } from "@/lib/firebase/client";
import { syncUserProfile } from "@/lib/firebase/auth";

interface AuthContextValue {
  user: FirebaseUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let resolved = false;
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        resolved = true;
        setUser(firebaseUser);
        setLoading(false);
      },
      (error) => {
        resolved = true;
        console.error("Auth state error:", error);
        setUser(null);
        setLoading(false);
      }
    );

    const timer = setTimeout(() => {
      if (!resolved) {
        setLoading(false);
      }
    }, 3000);

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  // Sync profil ke Firestore setelah user ada (dipisah agar loading tidak nge-hang offline)
  useEffect(() => {
    if (!user) return;
    syncUserProfile(user).catch((err: unknown) => {
      console.error("syncUserProfile failed:", err);
    });
  }, [user]);

  const value = useMemo(() => ({ user, loading }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

/** Ambil Firebase ID token untuk memanggil API server. */
export function useAuthToken(): () => Promise<string | null> {
  const { user } = useAuth();
  return useCallback(async () => {
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch {
      return null;
    }
  }, [user]);
}
