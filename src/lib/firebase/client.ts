import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBxOnSAIBdsjVM-svXC-zXLlG58Xil2uds",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "chatcodzy.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "chatcodzy",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "chatcodzy.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "587769458743",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:587769458743:web:1c373507f4e33b8fae4fb2",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
