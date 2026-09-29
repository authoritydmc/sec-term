import { ExportOptions, SecretItem } from "../types.js";
import { fetchParametersByPath } from "../aws/ssm.js";
import { formatDotenv } from "../utils/dotenv.js";

/**
 * Format secret items into the requested string format (env, json, yaml).
 */
export function formatSecretItems(
  items: SecretItem[],
  format: "env" | "json" | "yaml" = "env"
): string {
  const records: Record<string, string> = {};
  for (const item of items) {
    records[item.key] = item.value;
  }

  if (format === "json") {
    return JSON.stringify(records, null, 2);
  }

  if (format === "yaml") {
    const lines: string[] = [];
    for (const [k, v] of Object.entries(records)) {
      if (v.includes("\n") || v.includes(":") || v.includes("#")) {
        lines.push(`${k}: ${JSON.stringify(v)}`);
      } else {
        lines.push(`${k}: ${v}`);
      }
    }
    return lines.join("\n") + "\n";
  }

  return formatDotenv(records);
}

/**
 * Fetch and export secrets from AWS SSM.
 */
export async function exportSecrets(
  pathPrefix: string,
  options: ExportOptions = {}
): Promise<string> {
  const items = await fetchParametersByPath(pathPrefix, options);
  return formatSecretItems(items, options.format || "env");
}
