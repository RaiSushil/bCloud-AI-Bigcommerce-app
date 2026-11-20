/**
 * AES-256-GCM encryption for the stored bCloud dashboard password.
 *
 * Key: BCLOUD_ENCRYPTION_KEY = 32 random bytes, base64 (openssl rand -base64 32).
 * Each value is bound to its shop through GCM associated data, so a value
 * copied onto another shop's row will not decrypt.
 *
 * Stored format: v1.<iv>.<authTag>.<ciphertext>, each part base64url.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

export class EncryptionKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EncryptionKeyError";
  }
}

export function loadEncryptionKey(env: Record<string, string | undefined> = process.env): Buffer {
  const raw = env.BCLOUD_ENCRYPTION_KEY?.trim();
  if (!raw) throw new EncryptionKeyError("BCLOUD_ENCRYPTION_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new EncryptionKeyError("BCLOUD_ENCRYPTION_KEY must be 32 bytes encoded as base64");
  }
  return key;
}

export function encryptSecret(plaintext: string, shop: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(shop, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/** Throws if the value was tampered with, belongs to another shop, or uses another key. */
export function decryptSecret(stored: string, shop: string, key: Buffer): string {
  const parts = stored.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error("Unsupported encrypted secret format");
  const [, ivPart, tagPart, dataPart] = parts;
  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new Error("Malformed encrypted secret");
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  decipher.setAAD(Buffer.from(shop, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString(
    "utf8",
  );
}
