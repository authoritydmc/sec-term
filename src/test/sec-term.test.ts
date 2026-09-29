import test from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";
import os from "os";
import {
  parseDotenv,
  formatDotenv,
  computeSecretDiff,
  formatSecretItems,
  maskValue,
  encryptVault,
  decryptVault,
  encryptEnvFile,
  decryptVaultFile,
  loadSecrets,
  diffSecretPaths,
  SecretItem,
} from "../index.js";

test("parseDotenv and formatDotenv correctly handle quotes and key-values", () => {
  const envText = `
# Sample config
DATABASE_URL="postgres://user:pass@localhost:5432/mydb"
API_KEY=secret_key_12345
FEATURE_FLAG=true
MULTILINE="Line 1\\nLine 2"
`;

  const parsed = parseDotenv(envText);
  assert.strictEqual(parsed.DATABASE_URL, "postgres://user:pass@localhost:5432/mydb");
  assert.strictEqual(parsed.API_KEY, "secret_key_12345");
  assert.strictEqual(parsed.FEATURE_FLAG, "true");

  const formatted = formatDotenv(parsed);
  assert.ok(formatted.includes("DATABASE_URL="));
  assert.ok(formatted.includes("API_KEY="));
});

test("computeSecretDiff detects matching, differing, and missing keys", () => {
  const itemsA: SecretItem[] = [
    { key: "DB_PORT", fullPath: "/staging/DB_PORT", value: "5432", type: "String" },
    { key: "API_KEY", fullPath: "/staging/API_KEY", value: "secret-staging", type: "SecureString" },
    { key: "NEW_FEATURE", fullPath: "/staging/NEW_FEATURE", value: "enabled", type: "String" },
  ];

  const itemsB: SecretItem[] = [
    { key: "DB_PORT", fullPath: "/prod/DB_PORT", value: "5432", type: "String" },
    { key: "API_KEY", fullPath: "/prod/API_KEY", value: "secret-prod", type: "SecureString" },
    { key: "LEGACY_FLAG", fullPath: "/prod/LEGACY_FLAG", value: "true", type: "String" },
  ];

  const diffRows = computeSecretDiff(itemsA, itemsB);

  const matchRow = diffRows.find((r) => r.key === "DB_PORT");
  assert.strictEqual(matchRow?.status, "MATCH");

  const diffRow = diffRows.find((r) => r.key === "API_KEY");
  assert.strictEqual(diffRow?.status, "DIFF");

  const missingInB = diffRows.find((r) => r.key === "NEW_FEATURE");
  assert.strictEqual(missingInB?.status, "MISSING_IN_B");

  const missingInA = diffRows.find((r) => r.key === "LEGACY_FLAG");
  assert.strictEqual(missingInA?.status, "MISSING_IN_A");
});

test("formatSecretItems outputs env, json, and yaml formats", () => {
  const items: SecretItem[] = [
    { key: "PORT", fullPath: "/app/PORT", value: "3000", type: "String" },
    { key: "ENV", fullPath: "/app/ENV", value: "production", type: "String" },
  ];

  const envOut = formatSecretItems(items, "env");
  assert.ok(envOut.includes("PORT=3000"));
  assert.ok(envOut.includes("ENV=production"));

  const jsonOut = formatSecretItems(items, "json");
  const jsonParsed = JSON.parse(jsonOut);
  assert.strictEqual(jsonParsed.PORT, "3000");

  const yamlOut = formatSecretItems(items, "yaml");
  assert.ok(yamlOut.includes("PORT: 3000") || yamlOut.includes("PORT: \"3000\""));
});

test("maskValue masks secret characters", () => {
  assert.strictEqual(maskValue(""), "[EMPTY]");
  assert.strictEqual(maskValue(undefined), "[MISSING]");
  assert.strictEqual(maskValue("pass"), "****");
  assert.strictEqual(maskValue("supersecretpassword"), "su***rd");
});

test("AES-256-GCM Vault encrypts and decrypts accurately with authentication tag", () => {
  const secretContent = "DATABASE_URL=postgres://master:supersecret@db:5432/app\nAPI_KEY=live_xyz987";
  const passphrase = "correct-horse-battery-staple-2026";

  const payload = encryptVault(secretContent, passphrase);
  assert.strictEqual(payload.version, 1);
  assert.strictEqual(payload.algorithm, "aes-256-gcm");

  // Decrypt with correct passphrase
  const decrypted = decryptVault(payload, passphrase);
  assert.strictEqual(decrypted, secretContent);

  // Decrypt with invalid passphrase fails
  assert.throws(() => {
    decryptVault(payload, "wrong-passphrase");
  }, /Failed to decrypt vault/);
});

test("Local .env file diffing and vault loading without AWS", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "secx-test-"));
  const envStaging = path.join(tmpDir, ".env.staging");
  const envProd = path.join(tmpDir, ".env.prod");
  const vaultPath = path.join(tmpDir, "secrets.vault");

  fs.writeFileSync(envStaging, "PORT=3000\nAPI_URL=https://staging.api.com\nDEBUG=true\n");
  fs.writeFileSync(envProd, "PORT=3000\nAPI_URL=https://api.com\nPROD_ONLY=true\n");

  // 1. Test Diffing two local .env files
  const { rows, formattedTable } = await diffSecretPaths(envStaging, envProd);
  assert.ok(formattedTable.includes("API_URL"));
  const debugRow = rows.find(r => r.key === "DEBUG");
  assert.strictEqual(debugRow?.status, "MISSING_IN_B");
  const portRow = rows.find(r => r.key === "PORT");
  assert.strictEqual(portRow?.status, "MATCH");

  // 2. Test Encrypting .env to Vault file and loading secrets directly
  const passphrase = "test-vault-pass";
  encryptEnvFile(envProd, vaultPath, passphrase);
  assert.ok(fs.existsSync(vaultPath));

  const loadedFromVault = await loadSecrets(vaultPath, { passphrase });
  assert.strictEqual(loadedFromVault.length, 3);
  assert.strictEqual(loadedFromVault.find(i => i.key === "API_URL")?.value, "https://api.com");

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
