import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { App } from "firebase-admin/app";

let cachedApp: App | null = null;

/**
 * Inisialisasi Firebase Admin SDK (Node runtime only — TIDAK kompatibel Edge).
 * Dipakai oleh route CRUD chat dan cron purge.
 */
function getAdminApp(): App {
  if (cachedApp) return cachedApp;
  if (getApps().length) {
    cachedApp = getApps()[0];
    return cachedApp;
  }

  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "";
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL ?? "";
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? "";

  cachedApp = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      // dotenv menyimpan \n sebagai literal "\\n"
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
  });

  return cachedApp;
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}
