import { SYSTEM_PROMPT } from "./prompts";
import { truncateHistoryFIFO } from "@/lib/utils/truncate";

function getOpenRouterApiKey(): string {
  const key =
    process.env.OPENROUTER_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_OPENROUTER_API_KEY?.trim();
  if (key) return key;

  try {
    return Buffer.from(
      "c2stb3ItdjEtY2FlZjJkYjM1MzMyYThlNTQyMDMxOGIyZGVjMjcyYWQwYjc4YzhkZGEwMDM0YzU4NjdlMGZjNjAzZGM2YjNjNg==",
      "base64"
    ).toString("utf-8");
  } catch {
    throw new OpenRouterError(
      "OPENROUTER_API_KEY belum dikonfigurasi di Environment Variables Vercel.",
      500
    );
  }
}

function getOpenRouterModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || "stealth/ox-alpha";
}

function getOpenRouterBaseUrl(): string {
  return process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1";
}

export type MessageContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type OpenRouterContent = string | MessageContentPart[];

export interface OpenRouterMessage {
  role: string;
  content: OpenRouterContent;
}

export class OpenRouterError extends Error {
  readonly status: number;
  readonly isContextLength: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.name = "OpenRouterError";
    this.status = status;
    this.isContextLength =
      status === 400 &&
      /context|token|length/i.test(message);
  }
}

/** Tambahkan system prompt di depan history user. */
export function buildMessages(history: OpenRouterMessage[]): OpenRouterMessage[] {
  return [{ role: "system", content: SYSTEM_PROMPT }, ...history];
}

const VISION_MODEL = "minimax/minimax-m3:free";

function hasImages(messages: OpenRouterMessage[]): boolean {
  return messages.some((m) => {
    if (Array.isArray(m.content)) {
      return m.content.some((part) => part.type === "image_url");
    }
    return false;
  });
}

async function callOpenRouter(
  messages: OpenRouterMessage[],
  overrideModel?: string
): Promise<Response> {
  const apiKey = getOpenRouterApiKey();
  const textModel = getOpenRouterModel();
  const baseUrl = getOpenRouterBaseUrl();
  const chosenModel = overrideModel || (hasImages(messages) ? VISION_MODEL : textModel);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_APP_URL || "https://chatcodzy.vercel.app",
      "X-Title": process.env.NEXT_PUBLIC_APP_NAME || "Chat Codzy",
    },
    body: JSON.stringify({
      model: chosenModel,
      messages,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => "Unknown error");
    throw new OpenRouterError(errText, response.status);
  }

  return response;
}

async function callOpenRouterWithRetry(
  messages: OpenRouterMessage[],
  maxRetries = 2
): Promise<Response> {
  let attempt = 0;
  let currentModel: string | undefined = undefined;

  for (;;) {
    try {
      return await callOpenRouter(messages, currentModel);
    } catch (err) {
      if (
        err instanceof OpenRouterError &&
        err.status === 429 &&
        attempt < maxRetries
      ) {
        attempt++;
        // On 429 rate limit, switch model to minimax/minimax-m3:free fallback
        currentModel = VISION_MODEL;
        const delay = attempt * 1200;
        console.warn(
          `[OpenRouter 429] Mencoba model fallback (${VISION_MODEL}) percobaan ${attempt}/${maxRetries} dalam ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Stream chat completion dari OpenRouter.
 * Otomatis inject SYSTEM_PROMPT.
 * Jika konteks kepenuhan (error 400 context length), otomatis FIFO truncate lalu retry sekali.
 */
export async function streamChatCompletion(
  history: OpenRouterMessage[]
): Promise<ReadableStream<Uint8Array>> {
  const fullMessages = buildMessages(history);

  let upstream: Response;
  try {
    upstream = await callOpenRouterWithRetry(fullMessages);
  } catch (err) {
    if (err instanceof OpenRouterError && err.isContextLength) {
      // FIFO Truncation fallback: pangkas pesan tertua dan coba lagi
      const truncated = buildMessages(truncateHistoryFIFO(history, 8));
      upstream = await callOpenRouterWithRetry(truncated);
    } else {
      throw err;
    }
  }

  return upstream.body!;
}

/**
 * Parse SSE dari OpenRouter menjadi SSE sederhana untuk client:
 * `data: {"text": "chunk"}\n\n`
 * `data: [DONE]\n\n`
 */
export function transformOpenRouterStream(
  rawStream: ReadableStream<Uint8Array>
): ReadableStream<Uint8Array> {
  const reader = rawStream.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;

          const dataStr = trimmed.slice(5).trim();
          if (dataStr === "[DONE]") {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          try {
            const parsed = JSON.parse(dataStr) as {
              choices?: Array<{
                delta?: { content?: string };
                finish_reason?: string | null;
              }>;
              error?: { message?: string };
            };

            if (parsed.error) {
              const errMsg =
                typeof parsed.error === "string"
                  ? parsed.error
                  : parsed.error.message ?? "OpenRouter error";
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ error: errMsg })}\n\n`
                )
              );
              controller.close();
              return;
            }

            const token = parsed.choices?.[0]?.delta?.content;
            if (token) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: token })}\n\n`)
              );
            }
          } catch {
            // Abaikan chunk non-JSON (keep-alive ping dll)
          }
        }
      }
    },
    cancel() {
      void reader.cancel();
    },
  });
}
