import { type NextRequest, NextResponse } from "next/server";
import { getTelegramFileStream } from "@/lib/telegram/storage";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { fileId: string } }
): Promise<Response> {
  const { fileId } = params;

  if (!fileId) {
    return NextResponse.json({ error: "fileId parameter diperlukan." }, { status: 400 });
  }

  try {
    const { stream, contentType, contentLength } = await getTelegramFileStream(fileId);

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    };

    if (contentLength) {
      headers["Content-Length"] = contentLength.toString();
    }

    return new Response(stream, {
      status: 200,
      headers,
    });
  } catch (err: unknown) {
    console.error(`[GET /api/telegram/file/${fileId}] Error:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal mengambil file dari Telegram." },
      { status: 404 }
    );
  }
}
