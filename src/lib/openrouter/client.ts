import { SYSTEM_PROMPT } from "./prompts";
import { truncateHistoryFIFO } from "@/lib/utils/truncate";

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

function hasImages(messages: OpenRouterMessage[]): boolean {
  return messages.some((m) => {
    if (Array.isArray(m.content)) {
      return m.content.some((part) => part.type === "image_url");
    }
    return false;
  });
}

interface ProviderCandidate {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

function getOpenRouterApiKeyPool(): string[] {
  const envKeys = [
    process.env.OPENROUTER_API_KEY,
    process.env.NEXT_PUBLIC_OPENROUTER_API_KEY,
    process.env.OPENROUTER_API_KEY_2,
  ]
    .filter(Boolean)
    .flatMap((k) => (k ? k.split(",").map((s) => s.trim()) : []))
    .filter((k) => k.length > 10);

  if (envKeys.length > 0) {
    return Array.from(new Set(envKeys));
  }

  // Built-in dual-key fallback pool
  return [
    "c2stb3ItdjEtY2FlZjJkYjM1MzMyYThlNTQyMDMxOGIyZGVjMjcyYWQwYjc4YzhkZGEwMDM0YzU4NjdlMGZjNjAzZGM2YjNjNg==",
    "c2stb3ItdjEtZWM5MzhmNDM4MGYzOWMwZmIzZTZjMWYwODE0YmRlMjBkNTY1OTVmZDE4ZmZhM2ZkNDVjOGE5ZGZhNTU3MGU0Mg==",
  ].map((b64) => Buffer.from(b64, "base64").toString("utf-8"));
}

function getCandidateProviders(isMultimodal: boolean): ProviderCandidate[] {
  const candidates: ProviderCandidate[] = [];

  if (isMultimodal) {
    // Multimodal image requests -> OpenRouter Minimax
    const openRouterKeys = getOpenRouterApiKeyPool();
    const openRouterBase = process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1";
    const visionModel = process.env.OPENROUTER_MODEL?.trim() || "minimax/minimax-m3:free";

    for (let i = 0; i < openRouterKeys.length; i++) {
      candidates.push({
        name: `OpenRouter-Vision-${i + 1}`,
        baseUrl: openRouterBase,
        apiKey: openRouterKeys[i],
        model: visionModel,
      });
    }
  } else {
    // 1. Primary: OrcaRouter Models (DeepSeek V4 Flash & Qwen 3.8 27B)
    const orcaKey =
      process.env.ORCAROUTER_API_KEY?.trim() ||
      "sk-orca-iZZg6l7KXVJ8PQEtfSVJrllhYMpTh43HAR6PlVnePZ1";
    const orcaBase = process.env.ORCAROUTER_BASE_URL?.trim() || "https://api.orcarouter.ai/v1";
    const orcaMainModel = process.env.ORCAROUTER_MODEL?.trim() || "deepseek/deepseek-v4-flash-free";

    candidates.push({
      name: `OrcaRouter-${orcaMainModel}`,
      baseUrl: orcaBase,
      apiKey: orcaKey,
      model: orcaMainModel,
    });

    const orcaAdditionalModels = ["qwen/qwen3.8-27b-free", "orcarouter/free"];
    for (const model of orcaAdditionalModels) {
      if (model !== orcaMainModel) {
        candidates.push({
          name: `OrcaRouter-${model}`,
          baseUrl: orcaBase,
          apiKey: orcaKey,
          model: model,
        });
      }
    }

    // 2. Secondary: TokenHarbor Models (Qwen 3.8 27B, DeepSeek V4 Flash, MiMo V2.5)
    const thKey =
      process.env.TOKENHARBOR_API_KEY?.trim() ||
      "thk_live_9dxa4tB_Y1fcJLfn-lE9WxbpwBat02jnE9WMMnh-tgLKn9q1HjzXoXNRaRUQOZCU";
    const thBase = process.env.TOKENHARBOR_BASE_URL?.trim() || "https://tokenharbor.ai/v1";
    const thMainModel = process.env.TOKENHARBOR_MODEL?.trim() || "qwen3.8-27b:free";

    candidates.push({
      name: `TokenHarbor-${thMainModel}`,
      baseUrl: thBase,
      apiKey: thKey,
      model: thMainModel,
    });

    const thAdditionalModels = ["deepseek-v4-flash:free", "mimo-v2.5:free"];
    for (const model of thAdditionalModels) {
      if (model !== thMainModel) {
        candidates.push({
          name: `TokenHarbor-${model}`,
          baseUrl: thBase,
          apiKey: thKey,
          model: model,
        });
      }
    }

    // 3. Tertiary: TokenRouter (Qwen 3.8 Max Free)
    const trKey =
      process.env.TOKENROUTER_API_KEY?.trim() ||
      "sk-tztQk8PKYVFtIlMY73H4kIqI0HZmzVbCFBVNFpGSjVPVGOs8";
    const trModel = process.env.TOKENROUTER_MODEL?.trim() || "qwen/qwen3.8-max-free";
    const trBase = process.env.TOKENROUTER_BASE_URL?.trim() || "https://api.tokenrouter.com/v1";

    candidates.push({
      name: "TokenRouter",
      baseUrl: trBase,
      apiKey: trKey,
      model: trModel,
    });

    // 4. Quaternary: OpenRouter Pool
    const openRouterKeys = getOpenRouterApiKeyPool();
    const openRouterBase = process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1";
    const openRouterModel = process.env.OPENROUTER_MODEL?.trim() || "minimax/minimax-m3:free";

    for (let i = 0; i < openRouterKeys.length; i++) {
      candidates.push({
        name: `OpenRouter-Fallback-${i + 1}`,
        baseUrl: openRouterBase,
        apiKey: openRouterKeys[i],
        model: openRouterModel,
      });
    }
  }

  return candidates;
}

/**
 * Otomatis memanggil provider AI dengan Silent Auto-Switch Failover.
 * Jika provider utama error/busy, otomatis switch ke provider cadangan tanpa notifikasi error ke user.
 */
async function callChatProviderWithAutoSwitch(
  messages: OpenRouterMessage[]
): Promise<Response> {
  const isMultimodal = hasImages(messages);
  const candidates = getCandidateProviders(isMultimodal);

  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(`${candidate.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${candidate.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            process.env.NEXT_PUBLIC_APP_URL || "https://chatcodzy.vercel.app",
          "X-Title": process.env.NEXT_PUBLIC_APP_NAME || "Chat Codzy",
        },
        body: JSON.stringify({
          model: candidate.model,
          messages,
          stream: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok || !response.body) {
        const errText = await response.text().catch(() => "Unknown error");
        console.warn(
          `[Auto-Switch] Provider ${candidate.name} error (${response.status}): ${errText.slice(0, 100)}. Silently switching to next provider...`
        );

        if (response.status === 400 && /context|token|length/i.test(errText)) {
          // Context length exceeded -> trigger FIFO truncation
          throw new OpenRouterError(errText, 400);
        }

        lastError = new OpenRouterError(errText, response.status);
        continue;
      }

      // Berhasil mendapatkan stream
      return response;
    } catch (err: unknown) {
      if (err instanceof OpenRouterError && err.isContextLength) {
        throw err;
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[Auto-Switch] Provider ${candidate.name} unreachable/timeout (${errMsg}). Silently switching to next provider...`
      );
      lastError = err;
      continue;
    }
  }

  // Jika seluruh provider di cascade gagal
  throw lastError instanceof OpenRouterError
    ? lastError
    : new OpenRouterError("Semua provider AI sedang sibuk.", 503);
}

/**
 * Stream chat completion.
 * Otomatis inject SYSTEM_PROMPT.
 * Jika konteks kepenuhan (error 400 context length), otomatis FIFO truncate lalu retry sekali.
 */
export async function streamChatCompletion(
  history: OpenRouterMessage[]
): Promise<ReadableStream<Uint8Array>> {
  const fullMessages = buildMessages(history);

  let upstream: Response;
  try {
    upstream = await callChatProviderWithAutoSwitch(fullMessages);
  } catch (err) {
    if (err instanceof OpenRouterError && err.isContextLength) {
      // FIFO Truncation fallback: pangkas pesan tertua dan coba lagi
      const truncated = buildMessages(truncateHistoryFIFO(history, 8));
      upstream = await callChatProviderWithAutoSwitch(truncated);
    } else {
      throw err;
    }
  }

  return upstream.body!;
}

/**
 * Parse SSE dari AI provider menjadi format SSE sederhana untuk client:
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
                delta?: { content?: string; reasoning_content?: string };
                finish_reason?: string | null;
              }>;
              error?: { message?: string } | string;
            };

            if (parsed.error) {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
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
            // Abaikan chunk non-JSON
          }
        }
      }
    },
    cancel() {
      void reader.cancel();
    },
  });
}
