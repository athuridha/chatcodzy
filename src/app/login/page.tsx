"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { LoginForm } from "@/components/auth/LoginForm";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage(): React.JSX.Element {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/chat");
    }
  }, [user, loading, router]);

  if (loading || user) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center px-4">
        <Skeleton className="h-96 w-full max-w-md" />
      </main>
    );
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10">
      <LoginForm />
    </main>
  );
}
