"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";

/** Proteksi route: mengizinkan tamu di /chat dan mengalihkan ke /login untuk halaman privat seperti /profile. */
export function AuthGuard({ children }: { children: ReactNode }): React.JSX.Element {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Only redirect if unauthenticated user tries to access private routes like /profile
    if (!loading && !user && pathname.startsWith("/profile")) {
      router.replace("/login");
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Memuat…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
