import { SecretItem, ExportOptions } from "../types.js";
import { loadSecrets } from "./loader.js";
import { formatDotenv } from "../utils/dotenv.js";

/**
 * Format secret items into .env, JSON, or YAML text.
 */
export function formatSecretItems(items: SecretItem[], format: "env" | "json" | "yaml" = "env"): string {
  const dict: Record<string, string> = {};
  for (const item of items) {
    dict[item.key] = item.value;
  }

  if (format === "json") {
    return JSON.stringify(dict, null, 2) + "\n";
  }

  if (format === "yaml") {
    const lines = Object.entries(dict).map(([k, v]) => {
      if (v.includes("\n") || v.includes(":") || v.includes('"') || v.includes("#")) {
        return `${k}: "${v.replace(/"/g, '\\"')}"`;
      }
      return `${k}: ${v}`;
    });
    return lines.join("\n") + "\n";
  }

  // Default: .env
  return formatDotenv(dict);
}

/**
 * Fetch and export secrets from AWS SSM or local target to standard format.
 */
export async function exportSecrets(
  target: string,
  options: ExportOptions = {}
): Promise<string> {
  const items = await loadSecrets(target, options);
  return formatSecretItems(items, options.format || "env");
}
