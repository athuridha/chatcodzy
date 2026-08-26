import { NextRequest, NextResponse } from "next/server";
import type { DocumentData, QueryDocumentSnapshot } from "firebase-admin/firestore";

import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/chats — daftar chat aktif milik user (exclude soft-deleted). */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const idToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;
    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifyIdToken(idToken);

    const snapshot = await getAdminDb()
      .collection("chats")
      .where("userId", "==", decoded.uid)
      .get();

interface AdminChatRecord {
  chatId: string;
  deletedAt?: { toMillis?: () => number } | null;
  updatedAt?: { toMillis?: () => number } | null;
  [key: string]: unknown;
}

const chats: AdminChatRecord[] = snapshot.docs.map(
  (d: QueryDocumentSnapshot<DocumentData>) => ({
    chatId: d.id,
    ...(d.data() as Record<string, unknown>),
  })
);

const activeChats = chats
  .filter((chat) => !chat.deletedAt)
  .sort(
    (a, b) =>
      (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0)
  );

return NextResponse.json({ chats: activeChats });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[GET /api/chats]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
