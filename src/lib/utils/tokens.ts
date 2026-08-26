/**
 * Estimasi jumlah token dari teks.
 * Heuristik sederhana: ~3 karakter per token (campuran EN/ID).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}
