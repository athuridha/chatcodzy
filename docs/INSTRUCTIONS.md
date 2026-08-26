# INSTRUCTIONS.md — Panduan Eksekusi & Implementasi Proyek

> **Dokumen panduan langkah-demi-langkah (Execution Runbook) bagi developer untuk membangun dan mendeploy project ini secara presisi sesuai spesifikasi PRD.**

---

## Daftar Isi

1. [Project Overview & Quick Reference](#1-project-overview--quick-reference)
2. [Environment Setup & Configuration (.env)](#2-environment-setup--configuration-env)
3. [Phased Implementation Roadmap (Execution Steps)](#3-phased-implementation-roadmap-execution-steps)
4. [Testing & Quality Assurance Plan](#4-testing--quality-assurance-plan)
5. [Deployment & Production Runbook](#5-deployment--production-runbook)

---

## 1. Project Overview & Quick Reference

### 1.1 Ringkasan Produk

**ChatBot AI Personal dengan Memori Permanen** adalah aplikasi web chatbot percakapan mirip ChatGPT yang ditenagai oleh **OpenRouter API** (model `ox-alpha`/stealth). Nilai jual utama adalah **memori jangka panjang permanen** — seluruh riwayat percakapan disimpan di Firebase Firestore dan disuntikkan kembali (*full history injection*) ke model AI pada setiap request, sehingga asisten memiliki konteks kontinyu antar sesi.

**Tujuan Implementasi:**
- Menyediakan asisten AI personal dengan memori permanen.
- Streaming respons real-time per token via Server-Sent Events (SSE).
- Autentikasi aman multi-provider (GitHub, Google, Email).
- UI/UX bersih, responsif, dan mobile-friendly.
- Biaya operasional rendah (Vercel free plan + Firebase spark).

### 1.2 Arsitektur Sistem Tingkat Tinggi

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser Client (Next.js SPA)                                    │
│  - React Components + Tailwind + shadcn/ui                       │
│  - Firebase Client SDK (Auth + Firestore)                        │
└────────────┬─────────────────────────────────┬───────────────────┘
             │ HTTPS / SSE                      │ Auth (OAuth)
             ▼                                  ▼
┌─────────────────────────────┐    ┌────────────────────────────┐
│ Vercel Edge Functions       │    │ Firebase Authentication    │
│  /api/chat  (SSE Stream)    │    │  - GitHub / Google / Email │
│  /api/chat/[chatId] (CRUD)  │    └────────────────────────────┘
│  /api/cron/purge-chats      │                │
└──────┬──────────────┬───────┘                ▼
       │              │              ┌────────────────────────────┐
       │              │              │ Firebase Firestore         │
       │              └──────────────▶  - users/{uid}             │
       │                             │  - chats/{chatId}          │
       │                             │  - messages (subcollect.)  │
       ▼                             └────────────────────────────┘
┌─────────────────────────────┐
│ OpenRouter API              │
│  model: ox-alpha (stealth)  │
│  endpoint: chat/completions │
└─────────────────────────────┘
```

**Target Platform:** Web (browser modern), deploy ke **Vercel (Free/Hobby Plan)**.

### 1.3 Dependensi & Environment Prerequisite

| Komponen | Versi Minimum | Keterangan |
|---|---|---|
| **Node.js** | `v18.17+` | LTS (Next.js 14+ membutuhkan Node 18.17 ke atas) |
| **Package Manager** | `pnpm` 8+ (recommended) / `npm` 9+ | Pilih salah satu, konsisten |
| **Next.js** | `14.2.x` | App Router + Edge Runtime |
| **TypeScript** | `5.4+` | Type-safe development |
| **Tailwind CSS** | `3.4+` | Utility-first styling |
| **Firebase** | `10.12+` | Client SDK (auth + firestore) |
| **Vercel CLI** | latest | Untuk deployment & cron testing |
| **Git** | `2.30+` | Version control |

**CLI Tools yang Harus Diinstall:**
```bash
# Wajib
node --version      # >= 18.17
npm --version       # >= 9  (atau pnpm --version >= 8)
git --version

# Opsional tapi sangat disarankan
pnpm --version      # jika pakai pnpm
vercel --version    # Vercel CLI untuk deploy lokal & env
```

**Akun & Layanan yang Harus Disiapkan:**
1. **Akun Firebase** + project baru (Spark/Blaze plan; untuk MVP cukup Spark).
2. **Akun OpenRouter** + API key (https://openrouter.ai/keys).
3. **Akun Vercel** (Hobby/Free tier sudah cukup).
4. **Akun GitHub** (untuk OAuth provider di Firebase).
5. **Akun Google Cloud Console** (untuk Google OAuth credential).

---

## 2. Environment Setup & Configuration (.env)

### 2.1 Variabel Lingkungan yang Dibutuhkan

Buat file `.env.example` di root project dengan isi berikut (developer tinggal copy ke `.env.local` dan isi nilainya):

```env
# ====================================================
# Firebase Client Configuration (NEXT_PUBLIC_ = exposed to browser)
# ====================================================
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# ====================================================
# OpenRouter Configuration (SERVER-SIDE ONLY, tidak boleh NEXT_PUBLIC_)
# ====================================================
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENROUTER_MODEL=ox-alpha
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# ====================================================
# Cron Job Security
# ====================================================
CRON_SECRET=generate-a-long-random-string-min-32-chars

# ====================================================
# App Configuration
# ====================================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=ChatBot AI Personal
```

### 2.2 Penjelasan Setiap Variabel

| Variabel | Tipe | Lokasi | Fungsi |
|---|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Public | Client + Server | API key Firebase Web app |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Public | Client + Server | Domain auth Firebase |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Public | Client + Server | ID project Firebase (untuk Firestore) |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Public | Client + Server | Bucket storage (jika将来 upload file) |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Public | Client + Server | Sender ID untuk FCM |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Public | Client + Server | App ID unik Firebase |
| `OPENROUTER_API_KEY` | **Secret** | **Server only** | API key OpenRouter untuk akses model `ox-alpha` |
| `OPENROUTER_MODEL` | Server | Server | Nama model (default: `ox-alpha`) |
| `OPENROUTER_BASE_URL` | Server | Server | Base URL endpoint OpenRouter |
| `CRON_SECRET` | **Secret** | Server | Token validasi Vercel Cron (Bearer auth) |
| `NEXT_PUBLIC_APP_URL` | Public | Client | URL dasar app (untuk OAuth redirect) |
| `NEXT_PUBLIC_APP_NAME` | Public | Client | Nama app (untuk title & metadata) |

> ⚠️ **PENTING:** `OPENROUTER_API_KEY` dan `CRON_SECRET` **JANGAN PERNAH** diberi prefix `NEXT_PUBLIC_`. Prefix tersebut akan mengekspos variabel ke client bundle dan membocorkan secret.

### 2.3 Konfigurasi Firebase — Langkah Detail

**A. Buat Project Firebase:**
1. Buka https://console.firebase.google.com/
2. Klik **"Add project"** → beri nama (misal: `chatbot-ai-personal`) → lanjutkan.
3. Setelah project dibuat, klik ikon **Web (`</>`)** untuk mendaftarkan app.
4. Isi nickname app → centang "Also set up Firebase Hosting" (tidak wajib, kita pakai Vercel) → **Register app**.
5. Copy konfigurasi `firebaseConfig` ke `.env.local`.

**B. Aktifkan Authentication Providers:**
1. Di sidebar Firebase Console → **Build → Authentication → Get started**.
2. Tab **Sign-in method**:
   - **Email/Password** → Enable → Save.
   - **Google** → Enable → isi project support email → Save.
   - **GitHub** → Enable → perlu setup OAuth App di GitHub (lihat langkah C).

**C. Setup GitHub OAuth App:**
1. Buka https://github.com/settings/developers → **New OAuth App**.
2. Isi:
   - **Application name**: `ChatBot AI Personal`
   - ** Homepage URL**: `http://localhost:3000` (dev) atau URL Vercel (prod)
   - **Authorization callback URL**: `https://YOUR_PROJECT_ID.firebaseapp.com/__/auth/handler`
3. Setelah dibuat, copy **Client ID** dan **Client Secret** ke Firebase Console → GitHub provider.
4. Save.

**D. Aktifkan Firestore Database:**
1. Sidebar → **Build → Firestore Database → Create database**.
2. Pilih mode: **Start in production mode** (akan kita setup rules kemudian).
3. Pilih region: `asia-southeast2 (Jakarta)` (atau yang terdekat dengan user).
4. Enable.

**E. Setup Firestore Security Rules (dasar):**
Masuk tab **Rules** di Firestore, paste:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users hanya bisa baca/tulis profil mereka sendiri
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    // Chats: hanya owner yang bisa akses
    match /chats/{chatId} {
      allow read, update, delete: if request.auth != null 
        && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null 
        && request.resource.data.userId == request.auth.uid;
      // Messages subcollection: owner chat yang bisa akses
      match /messages/{messageId} {
        allow read, write: if request.auth != null 
          && get(/databases/$(database)/documents/chats/$(chatId)).data.userId == request.auth.uid;
      }
    }
  }
}
```
Klik **Publish**.

### 2.4 Konfigurasi OpenRouter

1. Buka https://openrouter.ai/keys → **Create Key**.
2. Beri nama (misal: `chatbot-personal-prod`).
3. Copy key (format: `sk-or-v1-...`) ke `OPENROUTER_API_KEY` di `.env.local`.
4. **PENTING**: Pastikan akun OpenRouter memiliki credit cukup. Set **spending limit** untuk kontrol biaya.
5. Konfirmasi model `ox-alpha` tersedia di https://openrouter.ai/models (cek apakah masih stealth/accessible).

### 2.5 Skrip Inisialisasi Awal

Setelah environment variabel terisi, jalankan dari root project:

```bash
# 1. Install semua dependensi
npm install
# atau: pnpm install

# 2. Inisialisasi shadcn/ui (jika belum)
npx shadcn@latest init
# Pilih: TypeScript yes, New York style, Slate base color

# 3. Install komponen shadcn yang dibutuhkan
npx shadcn@latest add button input textarea dropdown-menu avatar 
  dialog toast sonner separator scroll-area sheet skeleton

# 4. Install dependensi tambahan
npm install firebase react-firebase-hooks
npm install react-markdown remark-gfm rehype-highlight rehype-raw
npm install uuid date-fns clsx tailwind-merge class-variance-authority
npm install lucide-react

# 5. Generate dev types
npm run dev
# Buka http://localhost:3000 — pastikan tidak ada error build

# 6. (Opsional) Link ke Vercel
npx vercel link
```

**File `package.json` — section scripts yang direkomendasikan:**
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "test": "vitest",
    "test:e2e": "playwright test"
  }
}
```

---

## 3. Phased Implementation Roadmap (Execution Steps)

Implementasi dibagi menjadi **4 fase** yang harus dikerjakan secara berurutan. Setiap fase memiliki deliverable yang harus lulus sebelum lanjut ke fase berikutnya.

---

### Fase 1: Fondasi, Skema Database & Autentikasi

**Tujuan:** Setup proyek, schema database siap, user bisa login/logout.

**Estimasi Durasi:** 2–3 hari

#### Step 1.1 — Setup Direktori & Konfigurasi Arsitektur

**Action Items:**
1. Inisialisasi Next.js project:
   ```bash
   npx create-next-app@latest chatbot-ai --typescript --tailwind --app --src-dir --import-alias "@/*" --use-npm
   cd chatbot-ai
   ```

2. **Buat struktur folder lengkap** sesuai PRD section 12. Buat semua direktori kosong terlebih dahulu (placeholder `.gitkeep`):
   ```bash
   mkdir -p src/{app,components,lib,hooks,contexts,types,styles}
   mkdir -p src/app/{login,chat,profile,api}
   mkdir -p src/app/chat/\[chatId\]
   mkdir -p src/app/api/{chat,chats,cron}
   mkdir -p src/app/api/chat/\[chatId\]
   mkdir -p src/app/api/cron/purge-chats
   mkdir -p src/components/{ui,auth,chat,sidebar,profile,shared}
   mkdir -p src/lib/{firebase,openrouter,utils}
   ```

3. **Setup path alias** di `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "baseUrl": ".",
       "paths": { "@/*": ["./src/*"] }
     }
   }
   ```

4. **Konfigurasi `tailwind.config.ts`** dengan font sesuai PRD:
   ```typescript
   import type { Config } from "tailwindcss";
   
   const config: Config = {
     darkMode: "class",
     content: ["./src/**/*.{ts,tsx}"],
     theme: {
       extend: {
         fontFamily: {
           sans: ["var(--font-geist-sans)", "ui-sans-serif", "sans-serif"],
           serif: ["serif"],
           mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
         },
       },
     },
     plugins: [require("tailwindcss-animate")],
   };
   export default config;
   ```

5. **Install Geist & JetBrains Mono** di `src/app/layout.tsx`:
   ```typescript
   import { GeistSans } from "geist/font/sans";
   import { JetBrains_Mono } from "next/font/google";
   ```

6. **Setup `.env.example`** (isi semua variabel dari section 2.1) dan `.env.local` (nilai asli).

7. **Buat `.gitignore`** standar Next.js + tambahkan `.env*.local`.

8. **Setup `vercel.json`** untuk cron:
   ```json
   {
     "crons": [
       { "path": "/api/cron/purge-chats", "schedule": "0 2 * * *" }
     ]
   }
   ```

**Deliverable Step 1.1:**
- ✅ Project Next.js bisa di-`npm run dev` tanpa error.
- ✅ Struktur folder lengkap sesuai PRD.
- ✅ TypeScript & path alias bekerja.

---

#### Step 1.2 — Definisi Tipe & Schema Database

**Action Items:**

1. **`src/types/user.ts`:**
   ```typescript
   export interface User {
     uid: string;
     email: string;
     displayName: string;
     photoURL: string | null;
     provider: "github" | "google" | "email";
     theme: "light" | "dark" | "system";
     createdAt: Date;
     updatedAt: Date;
   }
   ```

2. **`src/types/chat.ts`:**
   ```typescript
   export interface Chat {
     chatId: string;
     userId: string;
     title: string;
     createdAt: Date;
     updatedAt: Date;
     deletedAt: Date | null;
     messageCount: number;
   }
   ```

3. **`src/types/message.ts`:**
   ```typescript
   export interface Message {
     id: string;
     chatId: string;
     role: "user" | "assistant" | "system";
     content: string;
     timestamp: Date;
     tokenEstimate: number | null;
   }
   ```

4. **`src/lib/firebase/client.ts`** — Inisialisasi Firebase:
   ```typescript
   import { initializeApp, getApps } from "firebase/app";
   import { getAuth } from "firebase/auth";
   import { getFirestore } from "firebase/firestore";
   
   const firebaseConfig = {
     apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
     authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
     projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
     storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
     messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
     appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
   };
   
   const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
   export const auth = getAuth(app);
   export const db = getFirestore(app);
   ```

5. **Setup Firestore indexes** (akan dibuat otomatis saat pertama query, atau manual di Firebase Console):
   - `chats`: composite index `(userId ASC, deletedAt ASC, updatedAt DESC)`
   - `chats/{chatId}/messages`: index `(timestamp ASC)`

**Deliverable Step 1.2:**
- ✅ Type interfaces siap dipakai di seluruh project.
- ✅ Firebase client SDK terinisialisasi.
- ✅ Firestore security rules dipublish.

---

#### Step 1.3 — Implementasi Autentikasi Multi-Provider

**Action Items:**

1. **`src/lib/firebase/auth.ts`** — Helper functions:
   ```typescript
   import {
     signInWithEmailAndPassword, createUserWithEmailAndPassword,
     signInWithPopup, GithubAuthProvider, GoogleAuthProvider,
     signOut, updateProfile
   } from "firebase/auth";
   import { auth, db } from "./client";
   import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
   
   const githubProvider = new GithubAuthProvider();
   const googleProvider = new GoogleAuthProvider();
   
   export const signInWithGithub = () => signInWithPopup(auth, githubProvider);
   export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
   export const signInWithEmail = (email: string, password: string) => 
     signInWithEmailAndPassword(auth, email, password);
   export const signUpWithEmail = async (email: string, password: string, displayName: string) => {
     const cred = await createUserWithEmailAndPassword(auth, email, password);
     if (cred.user) await updateProfile(cred.user, { displayName });
     return cred;
   };
   export const logout = () => signOut(auth);
   
   // Sinkronisasi profil user ke Firestore
   export const syncUserProfile = async (firebaseUser: any) => {
     const userRef = doc(db, "users", firebaseUser.uid);
     const snapshot = await getDoc(userRef);
     const provider = firebaseUser.providerData[0]?.providerId || "email";
     const data = {
       uid: firebaseUser.uid,
       email: firebaseUser.email,
       displayName: firebaseUser.displayName || "User",
       photoURL: firebaseUser.photoURL || null,
       provider: provider.includes("github") ? "github" : provider.includes("google") ? "google" : "email",
       updatedAt: serverTimestamp(),
     };
     if (!snapshot.exists()) {
       await setDoc(userRef, { ...data, createdAt: serverTimestamp(), theme: "system" });
     } else {
       await setDoc(userRef, data, { merge: true });
     }
   };
   ```

2. **`src/contexts/AuthContext.tsx`:**
   ```typescript
   "use client";
   import { createContext, useContext, useEffect, useState, ReactNode } from "react";
   import { User as FirebaseUser, onAuthStateChanged } from "firebase/auth";
   import { auth } from "@/lib/firebase/client";
   import { syncUserProfile } from "@/lib/firebase/auth";
   
   interface AuthContextValue {
     user: FirebaseUser | null;
     loading: boolean;
   }
   
   const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });
   
   export function AuthProvider({ children }: { children: ReactNode }) {
     const [user, setUser] = useState<FirebaseUser | null>(null);
     const [loading, setLoading] = useState(true);
   
     useEffect(() => {
       const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
         setUser(firebaseUser);
         if (firebaseUser) await syncUserProfile(firebaseUser);
         setLoading(false);
       });
       return () => unsubscribe();
     }, []);
   
     return (
       <AuthContext.Provider value={{ user, loading }}>
         {children}
       </AuthContext.Provider>
     );
   }
   
   export const useAuth = () => useContext(AuthContext);
   ```

3. **`src/hooks/useAuth.ts`** — Re-export hook dengan helper login/logout.

4. **`src/components/auth/AuthGuard.tsx`:**
   ```typescript
   "use client";
   import { useRouter } from "next/navigation";
   import { useEffect } from "react";
   import { useAuth } from "@/contexts/AuthContext";
   
   export function AuthGuard({ children }: { children: React.ReactNode }) {
     const { user, loading } = useAuth();
     const router = useRouter();
   
     useEffect(() => {
       if (!loading && !user) router.push("/login");
     }, [user, loading, router]);
   
     if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
     if (!user) return null;
     return <>{children}</>;
   }
   ```

5. **`src/app/login/page.tsx`** — Halaman login dengan 3 provider:
   - Form email/password (login & toggle ke signup).
   - Tombol GitHub & Google (panggil `signInWithGithub` / `signInWithGoogle`).
   - Redirect ke `/chat` jika sudah login.

6. **Wrap `layout.tsx`** dengan `<AuthProvider>`.

**Deliverable Step 1.3:**
- ✅ User bisa sign up & login via Email/Password, GitHub, Google.
- ✅ Profil user otomatis ter-create di Firestore `users/{uid}`.
- ✅ Route yang butuh auth terproteksi `AuthGuard`.
- ✅ Logout membersihkan session.

**Acceptance Test Fase 1:**
- [ ] Login Email → muncul di Firebase Console Authentication.
- [ ] Login GitHub OAuth → popup muncul dan berhasil.
- [ ] Login Google OAuth → popup muncul dan berhasil.
- [ ] Setelah login, redirect ke `/chat` (placeholder).
- [ ] Logout dari tombol → kembali ke `/login`.
- [ ] Refresh halaman saat login → session persist (tidak logout).

---

### Fase 2: Core Backend API & Business Logic Handlers

**Tujuan:** Semua endpoint API siap, streaming berfungsi, CRUD chat jalan.

**Estimasi Durasi:** 3–4 hari

#### Step 2.1 — Setup OpenRouter Client & Streaming Utility

**Action Items:**

1. **`src/lib/openrouter/client.ts`:**
   ```typescript
   import { Message } from "@/types/message";
   
   const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
   const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "ox-alpha";
   const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
   
   export async function streamChatCompletion(
     messages: Array<{ role: string; content: string }>
   ): Promise<ReadableStream<Uint8Array>> {
     const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
       method: "POST",
       headers: {
         "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
         "Content-Type": "application/json",
         "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
         "X-Title": process.env.NEXT_PUBLIC_APP_NAME || "ChatBot AI",
       },
       body: JSON.stringify({
         model: OPENROUTER_MODEL,
         messages,
         stream: true,
         temperature: 0.7,
       }),
     });
   
     if (!response.ok || !response.body) {
       const err = await response.text();
       throw new Error(`OpenRouter error: ${response.status} - ${err}`);
     }
   
     return response.body;
   }
   
   // Parse SSE stream menjadi format yang dikirim ke client
   export function transformOpenRouterStream(input: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
     const reader = input.getReader();
     const decoder = new TextDecoder();
     const encoder = new TextEncoder();
   
     return new ReadableStream({
       async start(controller) {
         let buffer = "";
         try {
           while (true) {
             const { done, value } = await reader.read();
             if (done) break;
             buffer += decoder.decode(value, { stream: true });
             const lines = buffer.split("\n");
             buffer = lines.pop() || "";
   
             for (const line of lines) {
               if (line.startsWith("data: ")) {
                 const data = line.slice(6).trim();
                 if (data === "[DONE]") {
                   controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                   continue;
                 }
                 try {
                   const parsed = JSON.parse(data);
                   const delta = parsed.choices?.[0]?.delta?.content || "";
                   if (delta) {
                     controller.enqueue(
                       encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`)
                     );
                   }
                 } catch (e) {
                   // skip malformed
                 }
               }
             }
           }
         } catch (e: any) {
           controller.enqueue(
             encoder.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`)
           );
         } finally {
           controller.close();
         }
       },
     });
   }
   ```

2. **`src/lib/utils/tokens.ts`** — Estimasi token sederhana:
   ```typescript
   export function estimateTokens(text: string): number {
     // Heuristik: ~4 karakter per token untuk bahasa Inggris,
     // ~1.5 karakter per token untuk bahasa Indonesia
     return Math.ceil(text.length / 3);
   }
   ```

3. **`src/lib/utils/truncate.ts`** — FIFO helper:
   ```typescript
   export function truncateHistoryFIFO(
     messages: Array<{ role: string; content: string }>,
     keepLast: number = 20
   ): Array<{ role: string; content: string }> {
     if (messages.length <= keepLast) return messages;
     // Selalu simpan system prompt (jika ada) di index 0
     const system = messages[0]?.role === "system" ? [messages[0]] : [];
     const recent = messages.slice(-keepLast);
     return [...system, ...recent];
   }
   ```

---

#### Step 2.2 — Edge API Route untuk Streaming Chat

**Action Items:**

**`src/app/api/chat/route.ts`:**
```typescript
import { NextRequest } from "next/server";
import { streamChatCompletion, transformOpenRouterStream } from "@/lib/openrouter/client";
import { truncateHistoryFIFO } from "@/lib/utils/truncate";
import { auth } from "@/lib/firebase/client"; // Catatan: Edge Firebase terbatas

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. Validasi user via Firebase ID token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    // NOTE: Verifikasi ID token di Edge runtime butuh firebase-admin 
    // atau jose. Untuk MVP, kita trust token dari client dan 
    // verify ownership di step Firestore. Alternatif: gunakan 
    // Node runtime function jika perlu verifikasi penuh.
    
    // 2. Parse body
    const { messages, chatId } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid messages" }), { status: 400 });
    }
    
    // 3. Tambahkan system prompt
    const systemMessage = {
      role: "system",
      content: "Kamu adalah asisten AI personal yang membantu pengguna dengan ramah, akurat, dan kontekstual. Kamu merujuk percakapan sebelumnya untuk menjaga kontinuitas."
    };
    const fullMessages = [systemMessage, ...messages];
    
    // 4. Stream dari OpenRouter dengan fallback FIFO
    let stream: ReadableStream<Uint8Array>;
    try {
      const rawStream = await streamChatCompletion(fullMessages);
      stream = transformOpenRouterStream(rawStream);
    } catch (err: any) {
      // Fallback: pangkas history jika context length exceeded
      if (err.message?.includes("context_length") || err.message?.includes("400")) {
        console.warn("Context length exceeded, truncating history...");
        const truncated = truncateHistoryFIFO(fullMessages, 10);
        const rawStream = await streamChatCompletion(truncated);
        stream = transformOpenRouterStream(rawStream);
      } else {
        throw err;
      }
    }
    
    // 5. Return sebagai SSE
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
```

> ⚠️ **Catatan Edge Runtime:** Firebase Admin SDK tidak sepenuhnya support Edge. Untuk MVP, kita gunakan Client SDK untuk read history (dipanggil dari frontend sebelum stream), dan trust user ID di header. Untuk production-grade, pindahkan verifikasi ke Node Function atau gunakan library `jose` untuk verify ID token.

---

#### Step 2.3 — CRUD Endpoint untuk Chat

**Action Items:**

**`src/app/api/chats/route.ts` — GET list chat:**
```typescript
import { NextRequest, NextResponse } from "next/server";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const uid = req.headers.get("X-User-Id"); // dari client (untuk MVP)
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  try {
    const q = query(
      collection(db, "chats"),
      where("userId", "==", uid),
      where("deletedAt", "==", null),
      orderBy("updatedAt", "desc")
    );
    const snapshot = await getDocs(q);
    const chats = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ chats });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

**`src/app/api/chat/[chatId]/route.ts` — GET/PUT/DELETE single chat:**
```typescript
import { NextRequest, NextResponse } from "next/server";
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp, 
         collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export const runtime = "edge";

export async function GET(req: NextRequest, { params }: { params: { chatId: string } }) {
  const uid = req.headers.get("X-User-Id");
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  try {
    const chatRef = doc(db, "chats", params.chatId);
    const chatSnap = await getDoc(chatRef);
    if (!chatSnap.exists()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const chatData = chatSnap.data();
    if (chatData.userId !== uid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    
    // Fetch messages subcollection
    const messagesQuery = query(
      collection(db, "chats", params.chatId, "messages"),
      orderBy("timestamp", "asc")
    );
    const messagesSnap = await getDocs(messagesQuery);
    const messages = messagesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    return NextResponse.json({ ...chatData, chatId: params.chatId, messages });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { chatId: string } }) {
  // ... update title (rename chat)
}

export async function DELETE(req: NextRequest, { params }: { params: { chatId: string } }) {
  // ... set deletedAt = serverTimestamp() (soft delete)
}
```

> **Untuk endpoint yang butuh Firebase Admin SDK (misal cron purge), gunakan Node runtime** dengan prefix `export const runtime = "nodejs"`. Admin SDK perlu install: `npm install firebase-admin` dan setup service account via `GOOGLE_APPLICATION_CREDENTIALS` atau env JSON.

---

#### Step 2.4 — Cron Endpoint untuk Purge Chat

**Action Items:**

**`src/app/api/cron/purge-chats/route.ts`:**
```typescript
import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// Inisialisasi Admin SDK (hanya sekali)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const adminDb = getFirestore();

// WAJIB: Gunakan Node runtime untuk Admin SDK
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // 1. Validasi CRON_SECRET
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    // 2. Hitung tanggal 30 hari lalu
    const thirtyDaysAgo = Timestamp.fromMillis(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    // 3. Query chat yang soft-deleted > 30 hari
    const snapshot = await adminDb.collection("chats")
      .where("deletedAt", "<=", thirtyDaysAgo)
      .limit(100) // batch limit
      .get();
    
    // 4. Hard delete + hapus subcollection messages
    const deletedIds: string[] = [];
    const batch = adminDb.batch();
    for (const docSnap of snapshot.docs) {
      // Hapus subcollection messages
      const messagesSnap = await docSnap.ref.collection("messages").get();
      messagesSnap.docs.forEach(m => batch.delete(m.ref));
      // Hapus parent chat
      batch.delete(docSnap.ref);
      deletedIds.push(docSnap.id);
    }
    await batch.commit();
    
    return NextResponse.json({ deleted: deletedIds.length, chatIds: deletedIds });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

**Setup Firebase Admin Credentials:**
1. Firebase Console → Project Settings → **Service Accounts** tab.
2. Klik **Generate new private key** → download JSON.
3. Extract dari JSON ke env vars:
   - `FIREBASE_ADMIN_CLIENT_EMAIL` ← `