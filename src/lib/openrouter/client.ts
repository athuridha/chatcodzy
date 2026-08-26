import { SYSTEM_PROMPT } from "./prompts";
import { truncateHistoryFIFO } from "@/lib/utils/truncate";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "stealth/ox-alpha";
const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";

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
const TEXT_MODEL = process.env.OPENROUTER_MODEL || "stealth/ox-alpha";

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
  const chosenModel = overrideModel || (hasImages(messages) ? VISION_MODEL : TEXT_MODEL);

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
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
 * Full History Injection + fallback FIFO sekali jika context length exceeded.
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
      console.warn("Context length exceeded, truncating history (FIFO)...");
      const truncated = truncateHistoryFIFO(fullMessages, 20);
      upstream = await callOpenRouterWithRetry(truncated);
    } else {
      throw err;
    }
  }

  return upstream.body as ReadableStream<Uint8Array>;
}

/**
 * Parse SSE dari OpenRouter menjadi SSE sederhana untuk client:
 *   data: {"delta":"..."}\n\n  → potongan teks
 *   data: {"done":true}\n\n    → selesai
 *   data: {"error":"..."}\n\n  → gagal
 */
export function transformOpenRouterStream(
  input: ReadableStream<Uint8Array>
): ReadableStream<Uint8Array> {
  const reader = input.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";

      const enqueueLine = (line: string): void => {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) return;

        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string | null } }>;
            error?: { message?: string } | string;
          };

          if (parsed.error) {
            const message =
              typeof parsed.error === "string"
                ? parsed.error
                : parsed.error.message ?? "OpenRouter error";
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
            );
            return;
          }

          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`)
            );
          }
        } catch {
          // skip malformed chunk
        }
      };

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) enqueueLine(line);
        }

        if (buffer.trim()) enqueueLine(buffer);
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stream failed";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
        );
      } finally {
        controller.close();
        reader.releaseLock();
      }
    },
    cancel() {
      void reader.cancel().catch(() => undefined);
    },
  });
}
