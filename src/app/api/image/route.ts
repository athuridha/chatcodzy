import { type NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const prompt = searchParams.get("prompt") || "futuristic art";
  const seed = searchParams.get("seed") || `${Math.floor(Math.random() * 1000000)}`;

  const targetUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;

  try {
    const res = await fetch(targetUrl);
    if (!res.ok) {
      return NextResponse.json({ error: "Gagal menghasilkan gambar AI" }, { status: 500 });
    }

    const imageArrayBuffer = await res.arrayBuffer();

    return new Response(imageArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": `inline; filename="codzy-ai-${Date.now()}.jpg"`,
      },
    });
  } catch (err: unknown) {
    console.error("[GET /api/image] Error:", err);
    return NextResponse.json({ error: "Gagal memproses gambar AI" }, { status: 500 });
  }
}
