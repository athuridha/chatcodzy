import { NextRequest, NextResponse } from "next/server";

import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { chatId: string };
}

async function authenticate(
  req: NextRequest
): Promise<string | NextResponse> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/** GET — detail chat + seluruh messages (owner only). */
export async function GET(
  req: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const uidOrRes = await authenticate(req);
  if (uidOrRes instanceof NextResponse) return uidOrRes;
  const { chatId } = ctx.params;

  try {
    const db = getAdminDb();
    const chatRef = db.collection("chats").doc(chatId);
    const chatSnap = await chatRef.get();

    if (!chatSnap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const chatData = chatSnap.data() as { userId?: string };
    if (chatData.userId !== uidOrRes) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const messagesSnap = await chatRef
      .collection("messages")
      .orderBy("timestamp", "asc")
      .get();

    const messages = messagesSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return NextResponse.json({
      ...chatData,
      chatId,
      messages,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[GET /api/chat/${chatId}]`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PUT — rename chat (owner only). */
export async function PUT(
  req: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const uidOrRes = await authenticate(req);
  if (uidOrRes instanceof NextResponse) return uidOrRes;
  const { chatId } = ctx.params;

  try {
    const body = (await req.json()) as { title?: unknown };
    if (
      typeof body.title !== "string" ||
      body.title.trim().length === 0 ||
      body.title.length > 200
    ) {
      return NextResponse.json({ error: "Judul tidak valid" }, { status: 400 });
    }

    const db = getAdminDb();
    const chatRef = db.collection("chats").doc(chatId);
    const chatSnap = await chatRef.get();

    if (!chatSnap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if ((chatSnap.data() as { userId?: string }).userId !== uidOrRes) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const title = body.title.replace(/\s+/g, " ").trim().slice(0, 50);
    await chatRef.update({ title, updatedAt: new Date() });

    return NextResponse.json({ success: true, title });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[PUT /api/chat/${chatId}]`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE — soft delete (set deletedAt), purge permanen lewat cron. */
export async function DELETE(
  req: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const uidOrRes = await authenticate(req);
  if (uidOrRes instanceof NextResponse) return uidOrRes;
  const { chatId } = ctx.params;

  try {
    const db = getAdminDb();
    const chatRef = db.collection("chats").doc(chatId);
    const chatSnap = await chatRef.get();

    if (!chatSnap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if ((chatSnap.data() as { userId?: string }).userId !== uidOrRes) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await chatRef.update({ deletedAt: new Date() });

    return NextResponse.json({
      success: true,
      deletedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[DELETE /api/chat/${chatId}]`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
