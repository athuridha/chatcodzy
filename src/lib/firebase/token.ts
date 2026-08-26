import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.notservice.gaccount.com";
const IDENTITY_TOOLKIT_URL = "https://identitytoolkit.googleapis.com/v1/accounts:lookup";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(JWKS_URL));
  }
  return jwks;
}

export interface VerifiedToken {
  uid: string;
  email: string | null;
}

interface LookupResponse {
  users?: Array<{
    localId?: string;
    email?: string;
  }>;
}

/**
 * Fallback verifikasi via Identity Toolkit REST API.
 * Google memvalidasi token langsung — tahan banting jika JWKS URL tidak terjangkau.
 */
async function verifyViaIdentityToolkit(
  token: string
): Promise<VerifiedToken | null> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(`${IDENTITY_TOOLKIT_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as LookupResponse;
    const user = data.users?.[0];
    if (!user?.localId) return null;

    return { uid: user.localId, email: user.email ?? null };
  } catch {
    return null;
  }
}

/**
 * Verifikasi Firebase ID token di Edge runtime tanpa Admin SDK.
 * Jalur cepat: jose + JWKS Google. Fallback: Identity Toolkit REST API.
 * - issuer: https://securetoken.google.com/<projectId>
 * - audience: <projectId>
 */
export async function verifyFirebaseIdToken(
  authorizationHeader: string | null
): Promise<VerifiedToken | null> {
  if (!authorizationHeader?.startsWith("Bearer ")) return null;

  const token = authorizationHeader.slice("Bearer ".length).trim();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
  if (!projectId || !token) return null;

  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });

    if (!payload.sub || typeof payload.sub !== "string") return null;

    return {
      uid: payload.sub,
      email:
        typeof payload.email === "string" ? (payload.email as string) : null,
    };
  } catch {
    // JWKS tidak terjangkau / kunci belum ter-cached → coba REST
    return verifyViaIdentityToolkit(token);
  }
}
