"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { APP_NAME } from "@/lib/constants";
import {
  signInWithEmail,
  signInWithGithub,
  signInWithGoogle,
  signUpWithEmail,
} from "@/lib/firebase/auth";

function firebaseErrorCodeMessage(code: string): string {
  const map: Record<string, string> = {
    "auth/invalid-email": "Format email tidak valid.",
    "auth/user-not-found": "Akun tidak ditemukan.",
    "auth/wrong-password": "Password salah.",
    "auth/invalid-credential": "Email atau password salah.",
    "auth/email-already-in-use": "Email sudah terdaftar.",
    "auth/weak-password": "Password minimal 6 karakter.",
    "auth/popup-closed-by-user": "Popup ditutup sebelum selesai.",
    "auth/popup-blocked": "Popup diblokir browser. Izinkan popup lalu coba lagi.",
    "auth/account-exists-with-different-credential":
      "Email sudah dipakai metode login lain.",
    "auth/network-request-failed": "Koneksi bermasalah. Cek internet kamu.",
  };
  return map[code] ?? "Terjadi kesalahan. Coba lagi.";
}

export function LoginForm(): React.JSX.Element {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<"github" | "google" | null>(null);

  // Sudah login → langsung ke /chat
  if (user) {
    void Promise.resolve().then(() => router.replace("/chat"));
  }

  const handleEmailSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    if (submitting) return;

    if (!email.trim() || password.length < 6) {
      toast("error", "Isi email dan password (min. 6 karakter).");
      return;
    }
    if (mode === "signup" && !displayName.trim()) {
      toast("error", "Nama tampilan wajib diisi saat mendaftar.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signup") {
        await signUpWithEmail(email.trim(), password, displayName.trim());
        toast("success", "Pendaftaran berhasil. Selamat datang!");
      } else {
        await signInWithEmail(email.trim(), password);
        toast("success", "Login berhasil.");
      }
      router.replace("/chat");
    } catch (err) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      toast("error", firebaseErrorCodeMessage(code));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOAuth = async (
    provider: "github" | "google"
  ): Promise<void> => {
    if (oauthBusy) return;
    setOauthBusy(provider);
    try {
      if (provider === "github") await signInWithGithub();
      else await signInWithGoogle();
      toast("success", "Login berhasil.");
      router.replace("/chat");
    } catch (err) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      toast("error", firebaseErrorCodeMessage(code));
    } finally {
      setOauthBusy(null);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <header className="space-y-1 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          Selamat datang di {APP_NAME}
        </h1>
        <p className="text-sm text-muted-foreground">
          Asisten AI pribadimu dengan memori permanen.
        </p>
      </header>

      <div>
        <Button
          type="button"
          variant="outline"
          className="w-full flex items-center justify-center gap-2.5 h-11 rounded-xl"
          onClick={() => void handleOAuth("google")}
          disabled={oauthBusy !== null || submitting}
        >
          {oauthBusy === "google" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          Lanjutkan dengan Google
        </Button>
      </div>

      <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        atau
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleEmailSubmit} className="space-y-3">
        {mode === "signup" && (
          <Input
            placeholder="Nama tampilan"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
          />
        )}
        <Input
          type="email"
          placeholder="nama@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <Input
          type="password"
          placeholder="Password (min. 6 karakter)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          <Mail className="h-4 w-4" />
          {mode === "signup" ? "Daftar dengan Email" : "Masuk dengan Email"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
        <button
          type="button"
          onClick={() =>
            setMode((m) => (m === "login" ? "signup" : "login"))
          }
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {mode === "login" ? "Daftar" : "Masuk"}
        </button>
      </p>
    </div>
  );
}
