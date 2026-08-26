# AGENTS.md — Master Rules & Coding Protocol for AI Agent

> Perhatian untuk AI Agent: Dokumen ini adalah **SINGLE SOURCE OF TRUTH** aturan coding, modular breakdown, dan tata cara komunikasi kamu saat mengimplementasikan project ini sesuai PRD yang telah disepakati. Setiap penyimpangan tanpa klarifikasi tertulis dari user akan dianggap sebagai **pelanggaran protokol**.

---

## 1. INQUIRY-FIRST PROTOCOL (Wajib Tanya Sebelum Asumsi) [CRITICAL]

### Prinsip Mutlak
AI Agent **DILARANG KERAS** membuat asumsi sepihak atau mengarang (hallucination) spesifikasi teknis/bisnis yang tidak tertulis secara eksplisit di PRD di atas. Jika ada ambiguitas, kamu WAJIB mengajukan pertanyaan klarifikasi **sebelum** menulis kode apa pun.

### Aturan Wajib Tanya ke User

| Situasi | Contoh Pertanyaan Wajib |
|---------|-------------------------|
| **Ambiguitas Fitur** – Alur, validasi, atau business rule belum 100% detail | *"Di PRD disebutkan 'fallback FIFO jika context length exceeded', tetapi tidak jelas apakah harus retry otomatis atau menampilkan error ke user. Opsi A: retry otomatis dengan pesan peringatan di console. Opsi B: tampilkan error toast dan minta user memulai chat baru. Mana yang dipilih?"* |
| **Pilihan Arsitektur / Library Tambahan** – Ingin menambah library atau mengubah struktur database | *"Saya lihat PRD menyebutkan 'Debounce update saat streaming' untuk efisiensi write. Apakah boleh menggunakan library seperti `lodash.debounce` atau lebih baik implementasi manual dengan `setTimeout`? Opsi A: lodash.debounce. Opsi B: manual. Rekomendasi saya: A karena lebih stabil."* |
| **UI/UX Direction** – Kompleksitas interaksi (animasi, modal, drawer) | *"Untuk sidebar mobile, PRD menyebutkan 'drawer dengan hamburger menu'. Apakah drawer harus sliding dari kiri (seperti ChatGPT) atau bottom sheet? Opsi A: slide-left. Opsi B: bottom sheet. Opsi C: full-screen overlay. Mohon konfirmasi."* |
| **Prioritas Implementasi** – Ketika ada fitur yang saling bergantung | *"PRD menyebutkan 'Search riwayat dengan filter sederhana di MVP' dan 'full-text search di fase Should Have'. Saat ini saya akan implementasi filter by title saja. Apakah setuju?"* |
| **Keputusan Teknis** – Perubahan env var, konfigurasi deployment, secret management | *"Vercel Cron membutuhkan CRON_SECRET. Apakah saya harus generate random string atau menggunakan secret dari Vercel Dashboard? Opsi A: generate acak dan simpan di .env.local. Opsi B: set manual di Vercel. Mohon petunjuk."* |

### Format Pertanyaan WAJIB
- **Satu pertanyaan per topik** (jika multi, gunakan bullet list).
- Berikan **konteks singkat** (2 kalimat maksimal).
- Sertakan **2–3 opsi solusi konkret** dengan rekomendasi mu.
- Jangan lanjutkan coding sebelum ada jawaban eksplisit.

---

## 2. MODULAR SYSTEM AWARENESS (Pemahaman Modul Project)

Project ini dibagi menjadi **5 Modul terisolasi** yang saling terhubung melalui antarmuka yang jelas. Setiap modul harus dikerjakan secara berurutan, dengan **tidak ada code overlap** antar modul kecuali yang sudah ditentukan.

### Modul 1: Foundation, Config & Database Layer
- **Isi**: Setup Next.js App Router, TypeScript, Tailwind, shadcn/ui, Firebase client config, env vars, file types (`user.ts`, `chat.ts`, `message.ts`), Firestore schema (users, chats, messages subcollection), globals.css, `next.config.mjs`, `tailwind.config.ts`, `tsconfig.json`, `vercel.json`.
- **Aturan**: Jangan buat logic bisnis apa pun. Hanya scaffold dan konfigurasi.
- **Output**: Project bisa dijalankan dengan `npm run dev` tanpa error.

### Modul 2: Authentication & Authorization Guards (RBAC)
- **Isi**: AuthContext (`signInWithGithub`, `signInWithGoogle`, `signInWithEmail`, `logout`, `onAuthStateChanged`), AuthGuard (redirect ke `/login` jika tidak login), halaman login (`/login/page.tsx`), profile sync ke Firestore `users/{uid}`.
- **Aturan**: Hanya satu role: `User`. Tidak ada admin. Firebase Auth menangani session, client SDK saja.
- **Output**: Login flow berfungsi penuh (GitHub, Google, Email/Password), halaman terproteksi.

### Modul 3: Core Business Logic & API Handlers
- **Isi**: OpenRouter client (`lib/openrouter/client.ts`), Edge endpoint `/api/chat` (POST, streaming SSE, fallback FIFO), CRUD endpoints `/api/chat/[chatId]` (GET, PUT, DELETE), `/api/chats` (GET), `/api/cron/purge-chats` (GET), Firestore Admin SDK (atau REST API fallback).
- **Aturan**: Semua endpoint harus validasi owner (userId dari token). Gunakan runtime 'edge' untuk streaming. Jangan expose API key ke client.
- **Output**: Semua API berfungsi dan bisa di-test dengan curl/Postman.

### Modul 4: Frontend Component Architecture & Interactive UI
- **Isi**: Sidebar (daftar chat, search, new chat, profile menu), ChatContainer (message list, input, empty state, loading state), ChatMessage (markdown render + syntax highlighting), ChatInput (textarea auto-resize + send button + stop button opsional), halaman `/chat` dan `/chat/[chatId]`, halaman profil (`/profile/page.tsx`), ThemeToggle, Toast.
- **Aturan**: Gunakan `min-h-[100dvh]` untuk layout utama, bukan `h-screen`. Responsif mobile-first dengan breakpoint `sm`, `md`, `lg`. Sidebar collapse jadi drawer di bawah `md`. Gunakan icon SVG (Phosphor Icons atau Radix Icons) – **DILARANG** emoji mentah.
- **Output**: UI lengkap, interaktif, responsif, dengan semua 4 state (loading, success, empty, error).

### Modul 5: Edge-Cases, State Handling & Verification
- **Isi**: Loading skeletons, empty states (dengan CTA), error boundaries, error toast, token estimator (opsional), stop generation, fallback FIFO error handling, edge case context length exceeded, edge case network failure.
- **Aturan**: Setiap komponen dinamis WAJIB memiliki 4 state. Empty state harus informatif dengan tombol aksi. Error state harus menampilkan pesan yang bisa dipahami user.
- **Output**: App robust, tidak crash di edge case.

---

## 3. STRICT ENGINEERING GUARDRAILS (Aturan Mutlak AI Coding)

### 3.1 TypeScript Strict Mode
- **WAJIB** mendefinisikan interface/type untuk semua props, API payloads, state, dan function signatures.
- Penggunaan `any` **BANNED** – kecuali untuk library yang tidak memiliki tipe (dengan `// @ts-ignore` yang diberi alasan).
- Gunakan `as const` untuk literal object jika memungkinkan.
- Contoh larangan:
  ```typescript
  // ❌ DILARANG
  const user = { name: 'John' } as any;
  function getData(id: any) { ... }
  
  // ✅ WAJIB
  interface User { name: string; uid: string; }
  function getData(id: string): Promise<User> { ... }
  ```

### 3.2 Viewport & Layout Stability
- **JANGAN** gunakan `h-screen` untuk layout utama (root layout). Gunakan `min-h-[100dvh]` agar tidak overflow di mobile browser.
- **WAJIB** gunakan CSS Grid untuk layout multi-kolom (sidebar + main area) daripada flexbox math manual.
- Contoh:
  ```tsx
  // ❌ DILARANG
  <div className="h-screen flex">
    <div className="w-64">Sidebar</div>
    <div className="flex-1">Content</div>
  </div>
  
  // ✅ WAJIB
  <div className="min-h-[100dvh] grid grid-cols-[auto_1fr]">
    <aside className="w-64">Sidebar</aside>
    <main>Content</main>
  </div>
  ```

### 3.3 No UI Slop & Zero Raw Emojis
- **DILARANG** menggunakan emoji mentah di markup/kode JSX. Gunakan **icon SVG** berkualitas tinggi dari library seperti `@phosphor-icons/react` atau `@radix-ui/react-icons`.
- Contoh larangan:
  ```tsx
  // ❌ DILARANG
  <button>🚀 Kirim</button>
  
  // ✅ WAJIB
  import { PaperPlaneRight } from '@phosphor-icons/react';
  <button><PaperPlaneRight size={20} /> Kirim</button>
  ```

### 3.4 Mandatory UI States (4 State Lengkap)
Setiap halaman dan komponen dinamis (termasuk daftar chat, detail chat, profil, search results) **WAJIB** memiliki 4 state:

| State | Deskripsi | Komponen yang Harus Ada |
|-------|-----------|-------------------------|
| **Loading** | Saat data sedang di-fetch | Skeleton (pulse animation), spinner, atau placeholder |
| **Success** | Data berhasil dimuat | Tampilkan konten normal |
| **Empty State** | Data kosong (tidak ada item) | Ilustrasi + pesan informatif + CTA (misal "Buat chat baru") |
| **Error State** | Gagal memuat data | Pesan error yang jelas + tombol "Coba Lagi" |

Contoh implementasi:
```tsx
function ChatList() {
  const { chats, loading, error } = useChats();
  if (loading) return <ChatListSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;
  if (chats.length === 0) return <EmptyState title="Belum ada chat" cta="Mulai percakapan" />;
  return <ChatItems chats={chats} />;
}
```

### 3.5 Security & Validation
- **Validasi input** di sisi server (API routes) **dan** frontend (form validation).
- **Jangan pernah** menyimpan credential atau API key di client-side code (env vars dengan prefix `NEXT_PUBLIC_` hanya untuk Firebase config publik).
- **Lindungi endpoint cron** dengan `CRON_SECRET` (validasi header Authorization).
- **Rate limiting** pertimbangkan untuk endpoint `/api/chat` (opsional, tapi dicatat sebagai risiko).

### 3.6 Spesifik Project: Firestore & Edge Runtime
- **Firestore**: Gunakan subcollection `messages` di bawah `chats` untuk efisiensi query. Jangan simpan entire messages array di dokumen chat (kecuali untuk MVP sementara).
- **Edge Runtime**: File `app/api/chat/route.ts` WAJIB memiliki `export const runtime = 'edge'`. Jangan import Firebase Admin SDK di sini karena tidak kompatibel. Gunakan REST API Firestore atau pindahkan logic ke Node runtime function terpisah jika diperlukan.
- **Streaming**: Gunakan `ReadableStream` untuk SSE. Jangan simpan per chunk ke Firestore – simpan hanya setelah stream selesai (atau di akhir stream) untuk efisiensi write.

---

## 4. STEP-BY-STEP AGENT IMPLEMENTATION WORKFLOW

Ketika user meminta kamu mengerjakan tugas/fitur, ikuti **5 langkah wajib** berikut:

### Langkah 1: Analyze PRD
- Baca kembali PRD section yang relevan.
- Identifikasi **business rule**, **input/output**, **error handling**, dan **batasan**.
- Catat modul mana yang terpengaruh.

### Langkah 2: Clarify (Jika Perlu)
- Jika ada ambiguitas, **ajukan pertanyaan** sesuai INQUIRY-FIRST PROTOCOL.
- **Jangan lanjutkan** sebelum mendapatkan jawaban eksplisit.

### Langkah 3: Draft Plan
- Tuliskan **modul dan file mana** yang akan dibuat/diubah.
- Jelaskan **logika inti** dalam 2-3 kalimat.
- Dapatkan persetujuan user sebelum coding.

### Langkah 4: Implement Cleanly
- Tulis kode modular, terisolasi, dan rapi.
- Ikuti struktur folder yang sudah ditentukan di PRD Section 12.
- Gunakan naming convention: `camelCase` untuk file/fungsi, `PascalCase` untuk komponen/type.
- Tambahkan komentar JSDoc untuk fungsi publik.

### Langkah 5: Run Pre-flight Checks
- Jalankan `npx tsc --noEmit` – pastikan **0 error**.
- Jalankan `npm run build` – pastikan **sukses**.
- Uji endpoint dengan curl atau Postman (jika API).
- Pastikan UI di browser (loading, success, empty, error).

---

## 5. PRE-FLIGHT VERIFICATION CHECKLIST

Sebelum menyatakan implementasi selesai, Agent **WAJIB** memverifikasi semua item di bawah ini. Centang hanya jika benar-benar lolos.

- [ ] **TypeScript Check**: `npx tsc --noEmit` lulus tanpa error.
- [ ] **Build Production**: `npm run build` sukses (tanpa warning kritis).
- [ ] **Endpoint API**:
  - [ ] `/api/chat` (POST) – streaming sukses & error handling (400, 401, 500, context length).
  - [ ] `/api/chat/[chatId]` (GET, PUT, DELETE) – validasi owner, soft delete bekerja.
  - [ ] `/api/chats` (GET) – return list chat sesuai kriteria.
  - [ ] `/api/cron/purge-chats` (GET) – hanya bisa diakses dengan CRON_SECRET yang benar.
- [ ] **UI Responsive**:
  - [ ] Test di viewport 375px (mobile) – sidebar collapse, layout tidak overflow.
  - [ ] Test di viewport 1280px (desktop) – sidebar terbuka, layout proporsional.
- [ ] **No Console Errors**:
  - [ ] Tidak ada error 404, 500, atau broken links.
  - [ ] Tidak ada console warning (unused variables, deprecated API).
- [ ] **State Coverage**:
  - [ ] Loading state ditampilkan saat data fetching.
  - [ ] Empty state ditampilkan jika data kosong.
  - [ ] Error state ditampilkan dengan tombol retry.
- [ ] **Security**:
  - [ ] API key tidak bocor ke client bundle.
  - [ ] Endpoint chat hanya bisa diakses oleh user yang login dan owner.
  - [ ] Cron endpoint dilindungi secret.

---

## 6. ATURAN TAMBAHAN SPESIFIK PROJECT

### 6.1 Full History Injection & Fallback FIFO
- **WAJIB** implementasi fallback FIFO: jika OpenRouter mengembalikan error `context_length_exceeded` (atau HTTP 400), potong 2 pesan terlama dari history, lalu retry sekali.
- Jika retry juga gagal, kirimkan error ke client dengan pesan yang jelas.
- Jangan pernah mengirimkan history kosong ke OpenRouter (harus ada minimal 1 pesan user).

### 6.2 Streaming & Firestore Write
- Saat streaming: **jangan simpan setiap chunk** ke Firestore. Simpan hanya setelah stream selesai (atau di akhir stream) dengan debounce.
- Gunakan `addDoc` untuk pesan baru, bukan `update` array (kecuali untuk batch update).
- Pastikan `messageCount` di dokumen chat di-increment setiap kali pesan baru ditambahkan.

### 6.3 Soft Delete & Cron Purge
- Soft delete: set field `deletedAt` ke `serverTimestamp()` (Firestore). Jangan hapus dokumen.
- Cron purge: query `where('deletedAt', '<=', now - 30 days)`. Gunakan `deleteDoc` untuk hard delete.
- **Wajib** validasi `CRON_SECRET` di header `Authorization: Bearer ${CRON_SECRET}`.

### 6.4 Markdown & Syntax Highlighting
- Gunakan `react-markdown` dengan `remark-gfm` (tabel, list, strikethrough) dan `rehype-highlight` (atau Shiki/Prism). Jangan gunakan library lain.
- Sanitasi output untuk mencegah XSS (default react-markdown aman, tapi pastikan tidak ada `dangerouslySetInnerHTML`).

### 6.5 Environment Variables
- **WAJIB** gunakan `NEXT_PUBLIC_FIREBASE_*` untuk Firebase config.
- **JANGAN** pernah expose `OPENROUTER_API_KEY` atau `CRON_SECRET` ke client.
- **WAJIB** sediakan `.env.example` dengan placeholder sesuai PRD Section 12.

---

## 7. LARANGAN MUTLAK (Zero Tolerance)

| Larangan | Konsekuensi |
|----------|-------------|
| Menggunakan `any` di TypeScript | Ulang implementasi |
| Menggunakan `h-screen` untuk layout utama | Debug layout |
| Menggunakan emoji mentah di UI | Refactor dengan icon |
| Membuat asumsi tanpa bertanya | Pelanggaran protokol → diskusi ulang |
| Menambahkan library tanpa konfirmasi | Rollback + klarifikasi |
| Mengekspos API key ke client bundle | Security breach → perbaiki segera |
| Membuat fitur di luar MVP (panel admin, upload file, multi-model) | Hapus kode |

---

## 8. PENUTUP

Dokumen ini adalah **konstitusi** kerja AI Agent untuk project ini. Setiap penyimpangan harus melalui diskusi dan persetujuan user. Kamu wajib membaca dan menginternalisasi seluruh isi AGENTS.md sebelum memulai implementasi. Jika ada keraguan, **tanya dulu**.

**Selamat bekerja, Agent. Disiplin adalah kunci.**