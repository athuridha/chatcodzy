import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "./client";
import { generateTitle } from "@/lib/utils/format";
import { estimateTokens } from "@/lib/utils/tokens";
import { MAX_TITLE_LENGTH } from "@/lib/constants";
import type { Chat } from "@/types/chat";
import type { MessageRole } from "@/types/message";

interface ChatDocData {
  userId: string;
  title: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  deletedAt: Timestamp | null;
  messageCount: number;
}

function toChat(id: string, data: ChatDocData): Chat {
  return {
    chatId: id,
    userId: data.userId,
    title: data.title,
    createdAt: data.createdAt?.toDate() ?? new Date(0),
    updatedAt: data.updatedAt?.toDate() ?? new Date(0),
    deletedAt: data.deletedAt?.toDate() ?? null,
    messageCount: data.messageCount ?? 0,
  };
}

/** Buat chat baru dengan judul dari pesan pertama. */
export async function createChat(
  userId: string,
  firstMessage: string
): Promise<string> {
  const ref = await addDoc(collection(db, "chats"), {
    userId,
    title: generateTitle(firstMessage, MAX_TITLE_LENGTH),
    messageCount: 0,
    deletedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Ambil daftar chat aktif milik user (sort client-side agar bebas composite index). */
export async function fetchUserChats(userId: string): Promise<Chat[]> {
  const q = query(collection(db, "chats"), where("userId", "==", userId));
  const snapshot = await getDocs(q);

  return snapshot.docs
    .map((d) => toChat(d.id, d.data() as ChatDocData))
    .filter((chat) => chat.deletedAt === null)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export interface ChatWithMessages extends Chat {
  messages: Array<{
    id: string;
    role: MessageRole;
    content: string;
    timestamp: Date;
    tokenEstimate: number | null;
    images?: string[];
    documents?: Array<{ name: string; size?: number }>;
  }>;
}

/** Muat satu chat beserta seluruh messages subcollection-nya. */
export async function fetchChatWithMessages(
  chatId: string
): Promise<ChatWithMessages | null> {
  const chatRef = doc(db, "chats", chatId);
  const chatSnap = await getDoc(chatRef);
  if (!chatSnap.exists()) return null;

  const chatData = chatSnap.data() as ChatDocData;

  const messagesQuery = query(
    collection(db, "chats", chatId, "messages"),
    orderBy("timestamp", "asc")
  );
  const messagesSnap = await getDocs(messagesQuery);
  const messages = messagesSnap.docs.map((d) => {
    const data = d.data();
    const ts = (data.timestamp as Timestamp | undefined)?.toDate();
    return {
      id: d.id,
      role: data.role as MessageRole,
      content: data.content as string,
      timestamp: ts ?? new Date(0),
      tokenEstimate: (data.tokenEstimate as number | null) ?? null,
      images: (data.images as string[] | undefined) ?? undefined,
      documents: (data.documents as Array<{ name: string; size?: number }> | undefined) ?? undefined,
    };
  });
  messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return {
    ...toChat(chatId, chatData),
    messages,
  };
}

export interface StoredMessageInput {
  role: MessageRole;
  content: string;
  images?: string[];
  documents?: Array<{ name: string; size?: number }>;
}

/** Simpan pesan baru ke subcollection + increment messageCount + touch updatedAt. */
export async function saveMessage(
  chatId: string,
  input: StoredMessageInput
): Promise<void> {
  await addDoc(collection(db, "chats", chatId, "messages"), {
    role: input.role,
    content: input.content,
    timestamp: Timestamp.now(),
    tokenEstimate: estimateTokens(input.content),
    ...(input.images && input.images.length > 0 ? { images: input.images } : {}),
    ...(input.documents && input.documents.length > 0 ? { documents: input.documents } : {}),
  });

  await updateDoc(doc(db, "chats", chatId), {
    messageCount: increment(1),
    updatedAt: serverTimestamp(),
  });
}

/** Soft delete: set deletedAt, dokumen tetap ada sampai di-purge cron 30 hari. */
export async function softDeleteChat(chatId: string): Promise<void> {
  await updateDoc(doc(db, "chats", chatId), {
    deletedAt: serverTimestamp(),
  });
}

/** Rename chat (opsional). */
export async function renameChat(
  chatId: string,
  title: string
): Promise<void> {
  await updateDoc(doc(db, "chats", chatId), {
    title: generateTitle(title, MAX_TITLE_LENGTH),
    updatedAt: serverTimestamp(),
  });
}

/** Hard delete langsung (dipakai admin/cron saja). */
export async function hardDeleteChat(chatId: string): Promise<void> {
  await deleteDoc(doc(db, "chats", chatId));
}

export const USER_MAX_STORAGE_BYTES = 512 * 1024 * 1024; // 512 MB
export const USER_MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

export interface StoredUserFile {
  id: string;
  name: string;
  size: number;
  type: "image" | "file";
  url: string;
  fileId?: string;
  createdAt: Date;
}

/** Record a new uploaded file in the user's storage library */
export async function recordUserFile(
  userId: string,
  item: {
    name: string;
    size: number;
    type: "image" | "file";
    url: string;
    fileId?: string;
  }
): Promise<string> {
  const fileRef = await addDoc(collection(db, "users", userId, "files"), {
    name: item.name,
    size: item.size,
    type: item.type,
    url: item.url,
    ...(item.fileId ? { fileId: item.fileId } : {}),
    createdAt: serverTimestamp(),
  });

  // Increment aggregate counters on user document
  try {
    await updateDoc(doc(db, "users", userId), {
      storageUsedBytes: increment(item.size),
      ...(item.type === "image"
        ? { imagesCount: increment(1) }
        : { filesCount: increment(1) }),
      updatedAt: serverTimestamp(),
    });
  } catch {
    /* non-blocking */
  }

  return fileRef.id;
}

/** Delete a file from user's storage library */
export async function deleteUserFile(
  userId: string,
  docId: string,
  fileSize: number,
  fileType: "image" | "file"
): Promise<void> {
  await deleteDoc(doc(db, "users", userId, "files", docId));

  try {
    await updateDoc(doc(db, "users", userId), {
      storageUsedBytes: increment(-Math.abs(fileSize)),
      ...(fileType === "image"
        ? { imagesCount: increment(-1) }
        : { filesCount: increment(-1) }),
      updatedAt: serverTimestamp(),
    });
  } catch {
    /* non-blocking */
  }
}

/** Fetch all stored files for a user (from files subcollection + scanned chat history) */
export async function fetchUserFiles(userId: string): Promise<StoredUserFile[]> {
  const filesMap = new Map<string, StoredUserFile>();

  // 1. Fetch from users/{userId}/files
  try {
    const snap = await getDocs(collection(db, "users", userId, "files"));
    snap.docs.forEach((d) => {
      const data = d.data();
      const ts = (data.createdAt as Timestamp | undefined)?.toDate();
      const item: StoredUserFile = {
        id: d.id,
        name: (data.name as string) || "File Tanpa Nama",
        size: (data.size as number) || 0,
        type: (data.type as "image" | "file") || "file",
        url: (data.url as string) || "",
        fileId: (data.fileId as string | undefined) ?? undefined,
        createdAt: ts ?? new Date(),
      };
      filesMap.set(item.url || item.id, item);
    });
  } catch (err) {
    console.error("fetchUserFiles subcollection error:", err);
  }

  // 2. Scan chats for any images or documents attached in past messages
  try {
    const chatsQuery = query(
      collection(db, "chats"),
      where("userId", "==", userId),
      where("deletedAt", "==", null)
    );
    const chatsSnap = await getDocs(chatsQuery);

    for (const chatDoc of chatsSnap.docs) {
      const msgQuery = query(collection(db, "chats", chatDoc.id, "messages"));
      const msgSnap = await getDocs(msgQuery);

      for (const msgDoc of msgSnap.docs) {
        const msgData = msgDoc.data();
        const ts = (msgData.timestamp as Timestamp | undefined)?.toDate() ?? new Date();

        // Images attached in message
        if (Array.isArray(msgData.images)) {
          msgData.images.forEach((imgUrl: string, idx: number) => {
            if (!imgUrl || filesMap.has(imgUrl)) return;
            // Estimate size from base64 length or default 120KB
            const estimatedBytes = imgUrl.startsWith("data:")
              ? Math.round((imgUrl.length * 3) / 4)
              : 120 * 1024;

            const item: StoredUserFile = {
              id: `msg-img-${msgDoc.id}-${idx}`,
              name: `Gambar-${chatDoc.id.slice(0, 5)}-${idx + 1}.jpg`,
              size: estimatedBytes,
              type: "image",
              url: imgUrl,
              createdAt: ts,
            };
            filesMap.set(imgUrl, item);
          });
        }

        // Documents attached in message
        if (Array.isArray(msgData.documents)) {
          msgData.documents.forEach((docItem: { name: string; size?: number }, idx: number) => {
            const key = `doc-${msgDoc.id}-${docItem.name}-${idx}`;
            if (filesMap.has(key)) return;

            const item: StoredUserFile = {
              id: key,
              name: docItem.name || "Dokumen",
              size: docItem.size || 25 * 1024,
              type: "file",
              url: "",
              createdAt: ts,
            };
            filesMap.set(key, item);
          });
        }
      }
    }
  } catch (err) {
    console.error("fetchUserFiles chat scan error:", err);
  }

  const result = Array.from(filesMap.values());
  result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return result;
}

