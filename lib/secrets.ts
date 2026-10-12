import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "./env";

/**
 * Chiffrement des clés personnelles en base (AES-256-GCM).
 * La clé de chiffrement dérive de NEXTAUTH_SECRET : changer ce secret rend les clés enregistrées illisibles
 * (les membres devront les ressaisir).
 */
function key(): Buffer {
  return createHash("sha256").update(`sortify:cles-perso:${env.nextAuthSecret}`).digest();
}

export function encrypt(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

export function decrypt(blob: string): string {
  const raw = Buffer.from(blob, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}
