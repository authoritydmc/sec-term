import fs from "fs";
import path from "path";
import { SecretItem, ClientOptions } from "../types.js";
import { fetchParametersByPath } from "../aws/ssm.js";
import { parseDotenv } from "../utils/dotenv.js";
import { loadSecretsFromVault } from "../vault/crypto.js";

/**
 * Universal loader: Loads secrets from either:
 * 1. Local .env file (e.g. .env, .env.staging, config.env)
 * 2. Local encrypted vault file (e.g. secrets.vault, .secx.vault)
 * 3. Local JSON file (e.g. secrets.json)
 * 4. AWS SSM Parameter Store hierarchy (e.g. /app/prod/ or ssm:///app/prod/)
 */
export async function loadSecrets(
  target: string,
  options: ClientOptions = {}
): Promise<SecretItem[]> {
  // Check if target is an existing local file or explicitly prefixed
  const isFileTarget = fs.existsSync(target) || target.startsWith("file://") || target.endsWith(".env") || target.endsWith(".json") || target.endsWith(".vault");

  if (isFileTarget && fs.existsSync(target)) {
    const stat = fs.statSync(target);
    if (stat.isFile()) {
      const ext = path.extname(target).toLowerCase();
      const content = fs.readFileSync(target, "utf8");

      if (ext === ".vault" || target.endsWith(".vault.json")) {
        const passphrase = options.passphrase || process.env.SECX_VAULT_PASSPHRASE || process.env.VAULT_PASSWORD || "";
        if (!passphrase) {
          throw new Error(`Passphrase required to decrypt '${target}'. Provide via --passphrase or SECX_VAULT_PASSPHRASE env var.`);
        }
        const records = loadSecretsFromVault(target, passphrase);
        return Object.entries(records).map(([key, value]) => ({
          key,
          fullPath: `${target}#${key}`,
          value,
          type: "Vault",
        }));
      }

      if (ext === ".json") {
        const json = JSON.parse(content);
        return Object.entries(json).map(([key, value]) => ({
          key,
          fullPath: `${target}#${key}`,
          value: typeof value === "object" ? JSON.stringify(value) : String(value),
          type: "File",
        }));
      }

      // Default: parse as .env
      const records = parseDotenv(content);
      return Object.entries(records).map(([key, value]) => ({
        key,
        fullPath: `${target}#${key}`,
        value,
        type: "File",
      }));
    }
  }

  // AWS SSM / Remote provider
  return fetchParametersByPath(target, options);
}
