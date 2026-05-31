/**
 * Signs and verifies one-shot session tokens used to hand off from the
 * BYOK OAuth callback to NextAuth's CredentialsProvider.
 * Tokens expire in 5 minutes and are consumed on use.
 */
import { createHmac, randomBytes } from "crypto";

interface HandoffPayload {
  spotifyId: string;
  displayName: string;
  exp: number;
}

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is not set");
  return s;
}

export function signHandoffToken(spotifyId: string, displayName: string): string {
  const payload: HandoffPayload = {
    spotifyId,
    displayName,
    exp: Math.floor(Date.now() / 1000) + 5 * 60,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(encoded).digest("hex");
  return `${encoded}.${sig}`;
}

export function verifyHandoffToken(token: string): HandoffPayload {
  const dot = token.lastIndexOf(".");
  if (dot === -1) throw new Error("Invalid token format");
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret()).update(encoded).digest("hex");
  // Constant-time compare
  if (sig.length !== expected.length) throw new Error("Invalid token signature");
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) throw new Error("Invalid token signature");
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as HandoffPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error("Token expired");
  return payload;
}
