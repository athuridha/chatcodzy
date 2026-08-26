"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { APP_NAME } from "@/lib/constants";

export default function LandingPage(): React.JSX.Element {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace("/chat");
  }, [loading, router]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-background select-none">
      <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      <div className="flex flex-col items-center gap-1">
        <span className="text-sm font-semibold tracking-tight uppercase text-foreground">
          {APP_NAME}
        </span>
        <p className="text-xs text-muted-foreground animate-pulse">
          Menyiapkan sistem...
        </p>
      </div>
    </div>
  );
}
