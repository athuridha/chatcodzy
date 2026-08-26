export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  provider: "github" | "google" | "email";
  theme: "light" | "dark" | "system";
  createdAt: Date;
  updatedAt: Date;
  storageUsedBytes?: number;
  filesCount?: number;
  imagesCount?: number;
}

export type ThemePreference = "light" | "dark" | "system";

export interface UserProfileDoc {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  provider: string;
  theme: ThemePreference;
  createdAt: unknown;
  updatedAt: unknown;
  storageUsedBytes?: number;
  filesCount?: number;
  imagesCount?: number;
}

export interface UserStorageItem {
  id: string;
  name: string;
  size: number;
  type: "image" | "file";
  url: string;
  fileId?: string;
  createdAt: Date;
}

export interface UserStorageStats {
  usedBytes: number;
  maxBytes: number; // 512 MB = 512 * 1024 * 1024
  maxUploadBytes: number; // 100 MB = 100 * 1024 * 1024
  filesCount: number;
  filesBytes: number;
  imagesCount: number;
  imagesBytes: number;
}
