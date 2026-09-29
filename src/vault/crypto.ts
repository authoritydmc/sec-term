import crypto from "crypto";
import fs from "fs";
import { parseDotenv, formatDotenv } from "../utils/dotenv.js";

const ALGORITHM = "aes-256-gcm";
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 32;

export interface VaultFilePayload {
  version: 1;
  algorithm: "aes-256-gcm";
  salt: string; // hex
  iv: string; // hex
  tag: string; // hex
  ciphertext: string; // hex
}

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, "sha256");
}

/**
 * Encrypt arbitrary plaintext or .env payload using AES-256-GCM.
 */
export function encryptVault(plaintext: string, passphrase: string): VaultFilePayload {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(passphrase, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    version: 1,
    algorithm: "aes-256-gcm",
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    ciphertext: encrypted.toString("hex"),
  };
}

/**
 * Decrypt a vault payload back into plaintext.
 */
export function decryptVault(payload: VaultFilePayload, passphrase: string): string {
  if (payload.algorithm !== "aes-256-gcm" || payload.version !== 1) {
    throw new Error(`Unsupported vault algorithm or version: ${payload.algorithm} v${payload.version}`);
  }

  const salt = Buffer.from(payload.salt, "hex");
  const iv = Buffer.from(payload.iv, "hex");
  const tag = Buffer.from(payload.tag, "hex");
  const ciphertext = Buffer.from(payload.ciphertext, "hex");

  const key = deriveKey(passphrase, salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    throw new Error("Failed to decrypt vault. Invalid passphrase or corrupted file.");
  }
}

/**
 * Encrypt a local .env file directly into a .secx.vault JSON file.
 */
export function encryptEnvFile(envFilePath: string, vaultFilePath: string, passphrase: string): void {
  const content = fs.readFileSync(envFilePath, "utf8");
  const payload = encryptVault(content, passphrase);
  fs.writeFileSync(vaultFilePath, JSON.stringify(payload, null, 2) + "\n", { mode: 0o600 });
}

/**
 * Decrypt a .secx.vault JSON file and return records or write to .env file.
 */
export function decryptVaultFile(vaultFilePath: string, passphrase: string, outputEnvFilePath?: string): string {
  const raw = fs.readFileSync(vaultFilePath, "utf8");
  const payload = JSON.parse(raw) as VaultFilePayload;
  const decrypted = decryptVault(payload, passphrase);

  if (outputEnvFilePath) {
    fs.writeFileSync(outputEnvFilePath, decrypted, { mode: 0o600 });
  }

  return decrypted;
}

/**
 * Load secrets dictionary directly from a .secx.vault file in-memory.
 */
export function loadSecretsFromVault(vaultFilePath: string, passphrase: string): Record<string, string> {
  const decrypted = decryptVaultFile(vaultFilePath, passphrase);
  return parseDotenv(decrypted);
}
