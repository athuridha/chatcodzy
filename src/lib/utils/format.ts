import { format, isToday, isYesterday } from "date-fns";
import type { Timestamp } from "firebase/firestore";

export function formatChatDate(value: Date | Timestamp | null | undefined): string {
  if (!value) return "";
  const date = "toDate" in value ? value.toDate() : value;
  if (!(date instanceof Date)) return "";

  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Kemarin";
  return format(date, "dd MMM yyyy");
}

/** Judul otomatis dari pesan pertama, maks 50 karakter. */
export function generateTitle(text: string, maxLen = 50): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean || "Percakapan baru";
  return `${clean.slice(0, maxLen - 1)}…`;
}
