import type { NextRequest } from "next/server";

import {
  OpenRouterError,
  streamChatCompletion,
  transformOpenRouterStream,
  type OpenRouterMessage,
  type OpenRouterContent,
} from "@/lib/openrouter/client";
import { verifyFirebaseIdToken } from "@/lib/firebase/token";

export const dynamic = "force-dynamic";

interface ChatRequestBody {
  chatId?: string;
  message?: string;
  images?: string[];
  history?: unknown;
}

function isHistoryValid(history: unknown): history is OpenRouterMessage[] {
  return (
    Array.isArray(history) &&
    history.every(
      (m): m is OpenRouterMessage =>
        typeof m === "object" &&
        m !== null &&
        typeof (m as { role?: unknown }).role === "string" &&
        ((m as { content?: unknown }).content !== undefined)
    )
  );
}

const jsonError = (message: string, status: number): Response =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function POST(req: NextRequest): Promise<Response> {
  console.log("[POST /api/chat] request received");

  // 1. Validasi user via Firebase ID token (Edge-compatible) atau Guest Mode
  const authHeader = req.headers.get("Authorization");
  const isGuest = authHeader === "Bearer guest";

  if (!isGuest) {
    const token = await verifyFirebaseIdToken(authHeader);
    if (!token) {
      return jsonError("Sesi login berakhir atau tidak valid. Silakan login ulang.", 401);
    }
  }

  // 2. Parse body
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (typeof body.message !== "string" || body.message.trim().length === 0) {
    return jsonError("Field 'message' wajib diisi", 400);
  }
  if (!isHistoryValid(body.history)) {
    return jsonError("Field 'history' harus array of messages", 400);
  }

  // 3. Multimodal content (text + images)
  let userContent: OpenRouterContent = body.message;
  if (Array.isArray(body.images) && body.images.length > 0) {
    userContent = [
      { type: "text", text: body.message },
      ...body.images.map((url) => ({
        type: "image_url" as const,
        image_url: { url },
      })),
    ];
  }

  // 4. Susun full history + pesan baru (Full History Injection)
  const history: OpenRouterMessage[] = [
    ...body.history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userContent },
  ];

  // 5. Stream dari OpenRouter
  let rawStream: ReadableStream<Uint8Array>;
  try {
    rawStream = await streamChatCompletion(history);
  } catch (err) {
    if (err instanceof OpenRouterError) {
      if (err.isContextLength) {
        return jsonError(
          "Percakapan sudah mencapai batas panjang konteks. Silakan mulai obrolan baru.",
          400
        );
      }
      return jsonError(
        "Layanan AI sedang sibuk. Silakan coba kirim pesan kembali beberapa saat lagi.",
        503
      );
    }
    console.error("[POST /api/chat] unexpected:", err);
    return jsonError("Terjadi kendala saat memproses pesan. Silakan coba lagi.", 500);
  }

  // 5. Return sebagai SSE
  return new Response(transformOpenRouterStream(rawStream), {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
