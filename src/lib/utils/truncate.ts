interface TruncatableMessage {
  role: string;
  content: unknown;
}

const DEFAULT_KEEP = 20;

/**
 * Fallback FIFO: simpan system prompt (index 0) + pesan-pesan terbaru,
 * buang pesan terlama jika history melebihi batas.
 */
export function truncateHistoryFIFO<T extends TruncatableMessage>(
  messages: T[],
  keepLast: number = DEFAULT_KEEP
): T[] {
  if (messages.length <= keepLast) return messages;

  const system = messages[0]?.role === "system" ? [messages[0]] : [];
  const recent = messages.slice(-keepLast);

  const result = [...system, ...recent];

  // Jangan pernah kirim history tanpa pesan user
  if (!result.some((m) => m.role === "user")) {
    return messages.filter((_, i) => i >= messages.length - keepLast);
  }

  return result;
}
