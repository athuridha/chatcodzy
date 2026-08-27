import { type NextRequest, NextResponse } from "next/server";
import { uploadToTelegramChannel } from "@/lib/telegram/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB per file limit (Telegram API safe limit)

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "File tidak ditemukan dalam request." }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Ukuran file melebihi batas maksimal upload 50 MB." },
        { status: 400 }
      );
    }

    const uid = (formData.get("uid") as string | null) || undefined;
    const name = (formData.get("name") as string | null) || undefined;
    const email = (formData.get("email") as string | null) || undefined;

    const filename = file.name || `upload-${Date.now()}`;
    const mimeType = file.type || "application/octet-stream";

    const uploadResult = await uploadToTelegramChannel(file, filename, mimeType, {
      uid,
      name,
      email,
    });

    return NextResponse.json({
      success: true,
      fileId: uploadResult.fileId,
      url: uploadResult.directUrl || uploadResult.proxyUrl,
      proxyUrl: uploadResult.proxyUrl,
      filename,
      size: file.size,
    });
  } catch (err: unknown) {
    console.error("[POST /api/upload] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal mengunggah file ke Telegram Storage." },
      { status: 500 }
    );
  }
}
