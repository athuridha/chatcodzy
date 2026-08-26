const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export interface TelegramUploadResult {
  fileId: string;
  filePath?: string;
  directUrl: string;
  proxyUrl: string;
}

export interface TelegramUserMeta {
  uid?: string;
  name?: string;
  email?: string;
}

/**
 * Upload any file (Image, Document, ZIP, etc.) directly to a Telegram Channel as unlimited cloud storage.
 * Attaches user identity metadata (UID, Name, Email) in the caption.
 */
export async function uploadToTelegramChannel(
  fileBlob: Blob,
  filename: string,
  mimeType: string,
  userMeta?: TelegramUserMeta
): Promise<TelegramUploadResult> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    throw new Error("TELEGRAM_BOT_TOKEN atau TELEGRAM_CHAT_ID belum dikonfigurasi.");
  }

  const isImage = mimeType.startsWith("image/");
  const endpoint = isImage
    ? `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`
    : `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`;

  const nowWib = new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const userName = userMeta?.name || (userMeta?.uid ? "User Terdaftar" : "Tamu (Guest)");
  const userIdentifier = userMeta?.email || userMeta?.uid || "guest";
  const sizeKb = (fileBlob.size / 1024).toFixed(1);

  const caption = [
    `📁 [Codzy Cloud Storage]`,
    `👤 User: ${userName} (${userIdentifier})`,
    `🆔 UID: ${userMeta?.uid || "guest"}`,
    `📄 File: ${filename}`,
    `📦 Ukuran: ${sizeKb} KB`,
    `⏱️ Waktu: ${nowWib} WIB`,
  ].join("\n");

  const formData = new FormData();
  formData.append("chat_id", TELEGRAM_CHAT_ID);
  formData.append("caption", caption);

  if (isImage) {
    formData.append("photo", fileBlob, filename);
  } else {
    formData.append("document", fileBlob, filename);
  }

  const res = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  const data = (await res.json()) as {
    ok: boolean;
    description?: string;
    result?: {
      photo?: Array<{ file_id: string }>;
      document?: { file_id: string; file_name?: string };
    };
  };

  if (!data.ok || !data.result) {
    throw new Error(`Gagal upload ke Telegram: ${data.description || "Unknown error"}`);
  }

  let fileId = "";
  if (isImage && data.result.photo && data.result.photo.length > 0) {
    // Highest resolution photo is last in the array
    fileId = data.result.photo[data.result.photo.length - 1].file_id;
  } else if (data.result.document) {
    fileId = data.result.document.file_id;
  }

  if (!fileId) {
    throw new Error("Tidak menemukan file_id dari respons Telegram.");
  }

  // Get File Path
  const fileRes = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
  );
  const fileData = (await fileRes.json()) as {
    ok: boolean;
    result?: { file_path?: string };
  };

  const filePath = fileData.result?.file_path || "";
  const directUrl = filePath
    ? `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`
    : "";

  return {
    fileId,
    filePath,
    directUrl,
    proxyUrl: `/api/telegram/file/${fileId}`,
  };
}

/**
 * Get direct download link or stream for a file from Telegram by file_id.
 */
export async function getTelegramFileStream(fileId: string): Promise<{
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  contentLength?: number;
}> {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN belum dikonfigurasi.");
  }

  const fileRes = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
  );
  const fileData = (await fileRes.json()) as {
    ok: boolean;
    description?: string;
    result?: { file_path?: string; file_size?: number };
  };

  if (!fileData.ok || !fileData.result?.file_path) {
    throw new Error(`File Telegram tidak ditemukan: ${fileData.description || ""}`);
  }

  const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileData.result.file_path}`;
  const downloadRes = await fetch(fileUrl);

  if (!downloadRes.ok || !downloadRes.body) {
    throw new Error(`Gagal mengunduh file dari Telegram (${downloadRes.status})`);
  }

  const contentType = downloadRes.headers.get("content-type") || "application/octet-stream";
  const contentLength = fileData.result.file_size;

  return {
    stream: downloadRes.body,
    contentType,
    contentLength,
  };
}
