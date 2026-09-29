import fs from "fs";
import { ImportOptions } from "../types.js";
import { parseDotenv } from "../utils/dotenv.js";
import { putParameter } from "../aws/ssm.js";

export interface ImportResult {
  total: number;
  uploaded: string[];
  errors: { key: string; error: string }[];
}

/**
 * Import a local .env or JSON file into AWS SSM Parameter Store.
 */
export async function importSecretsFromFile(
  pathPrefix: string,
  filePath: string,
  options: ImportOptions = {}
): Promise<ImportResult> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  let records: Record<string, string> = {};

  if (filePath.endsWith(".json")) {
    try {
      records = JSON.parse(content);
    } catch (err: any) {
      throw new Error(`Invalid JSON in file ${filePath}: ${err.message}`);
    }
  } else {
    records = parseDotenv(content);
  }

  const normalizedPrefix = pathPrefix.endsWith("/") ? pathPrefix : `${pathPrefix}/`;
  const type = options.secure ? "SecureString" : "String";

  const uploaded: string[] = [];
  const errors: { key: string; error: string }[] = [];

  for (const [key, value] of Object.entries(records)) {
    const fullPath = `${normalizedPrefix}${key}`;

    if (options.dryRun) {
      uploaded.push(fullPath);
      continue;
    }

    try {
      await putParameter(fullPath, value, type, {
        overwrite: options.overwrite !== false,
        kmsKeyId: options.kmsKeyId,
        region: options.region,
      });
      uploaded.push(fullPath);
    } catch (err: any) {
      errors.push({ key, error: err.message || String(err) });
    }
  }

  return {
    total: Object.keys(records).length,
    uploaded,
    errors,
  };
}
