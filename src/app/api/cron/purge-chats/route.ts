import { NextRequest, NextResponse } from "next/server";

import { getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const BATCH_LIMIT = 100;

/**
 * GET /api/cron/purge-chats — hard delete chat yang soft-deleted > 30 hari.
 * Dilindungi CRON_SECRET via header Authorization: Bearer <secret>.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  // Vercel Cron mengirim otomatis; manual test pakai curl + secret.
  const authHeader =
    req.headers.get("Authorization") ?? req.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);

    const snapshot = await db
      .collection("chats")
      .where("deletedAt", "<=", cutoff)
      .limit(BATCH_LIMIT)
      .get();

    const deletedChatIds: string[] = [];

    for (const docSnap of snapshot.docs) {
      // Hapus subcollection messages dulu (batch per 400 operasi)
      const messagesSnap = await docSnap.ref.collection("messages").get();
      let batch = db.batch();
      let ops = 0;

      for (const msg of messagesSnap.docs) {
        batch.delete(msg.ref);
        ops += 1;
        if (ops === 400) {
          await batch.commit();
          batch = db.batch();
          ops = 0;
        }
      }
      if (ops > 0) await batch.commit();

      // Hapus parent chat
      await docSnap.ref.delete();
      deletedChatIds.push(docSnap.id);
    }

    console.log(`[cron purge-chats] deleted ${deletedChatIds.length} chats`);
    return NextResponse.json({ deleted: deletedChatIds.length, chatIds: deletedChatIds });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[GET /api/cron/purge-chats]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
