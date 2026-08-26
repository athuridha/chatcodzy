import {
  GithubAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { User as FirebaseUser } from "firebase/auth";

import { auth, db } from "./client";
import type { ThemePreference } from "@/types/user";

const githubProvider = new GithubAuthProvider();
const googleProvider = new GoogleAuthProvider();

export function mapProvider(providerId: string): "github" | "google" | "email" {
  if (providerId.includes("github")) return "github";
  if (providerId.includes("google")) return "google";
  return "email";
}

export const signInWithGithub = (): Promise<never> =>
  signInWithPopup(auth, githubProvider) as unknown as Promise<never>;

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);

export const signInWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const signUpWithEmail = async (
  email: string,
  password: string,
  displayName: string
) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (cred.user) {
    await updateProfile(cred.user, { displayName });
  }
  return cred;
};

export const logout = () => signOut(auth);

/** Sinkronisasi profil user ke Firestore users/{uid} saat login. */
export const syncUserProfile = async (
  firebaseUser: FirebaseUser
): Promise<void> => {
  const userRef = doc(db, "users", firebaseUser.uid);
  const snapshot = await getDoc(userRef);
  const providerId =
    firebaseUser.providerData[0]?.providerId ?? "password";

  const baseData = {
    uid: firebaseUser.uid,
    email: firebaseUser.email ?? "",
    displayName: firebaseUser.displayName || "Pengguna",
    photoURL: firebaseUser.photoURL ?? null,
    provider: mapProvider(providerId),
    updatedAt: serverTimestamp(),
  };

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      ...baseData,
      theme: "system" as ThemePreference,
      createdAt: serverTimestamp(),
    });
  } else {
    await setDoc(userRef, baseData, { merge: true });
  }
};
