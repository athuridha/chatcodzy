# Chat Codzy

Web chatbot AI percakapan (ChatGPT-like) dengan **memori jangka panjang permanen**, ditenagai multi-provider AI cascade dengan silent auto-failover (OrcaRouter `deepseek-v4-flash-free` & `qwen3.8-27b-free`, TokenHarbor `qwen3.8-27b:free`, `deepseek-v4-flash:free`, `mimo-v2.5:free`, TokenRouter `qwen/qwen3.8-max-free`, dan OpenRouter `minimax/minimax-m3:free`), Firebase Auth, dan Firestore.

## Fitur

- Autentikasi multi-provider: GitHub, Google, Email/Password
- Streaming respons AI real-time via SSE (Edge Runtime)
- Full History Injection + fallback FIFO saat context length exceeded
- Riwayat percakapan tersimpan permanen di Firestore
- Sidebar: daftar chat, pencarian judul, hapus (soft delete 30 hari), ganti judul
- Render markdown + syntax highlighting (react-markdown + rehype-highlight)
- Tema light/dark/system, responsif mobile & desktop
- Stop generation, toast notifikasi, 4 state UI lengkap

## Menjalankan Lokal

```bash
npm install
npm run dev
```

Buka http://localhost:3000

## Konfigurasi

Salin `.env.example` → `.env.local`, isi semua nilai (Firebase web config, service account admin, OpenRouter key).

> `OPENROUTER_API_KEY`, `FIREBASE_ADMIN_*`, dan `CRON_SECRET` wajib tetap server-side. Jangan beri prefix `NEXT_PUBLIC_`.

## Firestore Security Rules

Publish rules ini di Firebase Console:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /chats/{chatId} {
      allow read, update, delete: if request.auth != null
        && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null
        && request.resource.data.userId == request.auth.uid;
      match /messages/{messageId} {
        allow read, write: if request.auth != null
          && get(/databases/$(database)/documents/chats/$(chatId)).data.userId == request.auth.uid;
      }
    }
  }
}
```

Aktifkan provider **Email/Password, Google, GitHub** di Firebase Authentication.

## Deploy ke Vercel

1. Push repo → import di Vercel.
2. Set semua env vars dari `.env.local`.
3. `vercel.json` sudah mendaftarkan cron purge `/api/cron/purge-chats` harian pukul 02:00 UTC.
4. Vercel Cron otomatis mengirim header Authorization — untuk test manual:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<app>.vercel.app/api/cron/purge-chats
```

## Skrip

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Build produksi |
| `npm run type-check` | `tsc --noEmit` |
| `npm run lint` | ESLint |
