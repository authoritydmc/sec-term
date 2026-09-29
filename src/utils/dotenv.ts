/**
 * Parse .env text into key-value records.
 */
export function parseDotenv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;

    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();

    // Remove wrapping quotes if present
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }

    result[key] = val;
  }

  return result;
}

/**
 * Format key-value pairs into standard .env string with quote escaping.
 */
export function formatDotenv(records: Record<string, string>): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(records)) {
    const valStr = String(value);
    // Quote if contains spaces, newlines, or quotes
    if (valStr.includes(" ") || valStr.includes("\n") || valStr.includes('"') || valStr.includes("$")) {
      const escaped = valStr.replace(/"/g, '\\"');
      lines.push(`${key}="${escaped}"`);
    } else {
      lines.push(`${key}=${valStr}`);
    }
  }

  return lines.join("\n") + "\n";
}
