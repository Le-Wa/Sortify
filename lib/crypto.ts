import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(envKey?: string): Buffer {
  const raw = envKey ?? process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY is not set");
  const buf = Buffer.from(raw, "hex");
  if (buf.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  return buf;
}

/** AES-256-GCM encrypt. Returns `iv:ciphertext:tag` base64-joined with colons. */
export function encryptAES256GCM(plaintext: string, envKey?: string): string {
  const key = getKey(envKey);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), encrypted.toString("base64"), tag.toString("base64")].join(":");
}

/** AES-256-GCM decrypt. Expects the format produced by encryptAES256GCM. */
export function decryptAES256GCM(payload: string, envKey?: string): string {
  const key = getKey(envKey);
  const parts = payload.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted payload");
  const [ivB64, encB64, tagB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const encrypted = Buffer.from(encB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/** SHA-256 hex digest — used to store invite codes without exposing them. */
export function hashInviteCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** Generate an invite code: `WORD-XXXXX` where XXXXX is a truncated HMAC. */
export function generateInviteCode(userId: string, timestamp: number): string {
  const secret = process.env.INVITE_SECRET ?? process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error("INVITE_SECRET is not set");
  const hmac = createHmac("sha256", secret)
    .update(`${userId}:${timestamp}`)
    .digest("hex")
    .toUpperCase()
    .slice(0, 5);
  const words = ["BEAT", "DROP", "VIBE", "TUNE", "WAVE", "FLOW", "SOUL", "JAZZ"];
  const word = words[timestamp % words.length];
  return `${word}-${hmac}`;
}

/** Constant-time string comparison to prevent timing attacks. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return createHmac("sha256", "compare").update(a).digest("hex") ===
         createHmac("sha256", "compare").update(b).digest("hex");
}
