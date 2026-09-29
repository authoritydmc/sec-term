import { SecretDiffRow, DiffOptions, SecretItem } from "../types.js";
import { loadSecrets } from "./loader.js";
import { drawDiffTable } from "../utils/color.js";

/**
 * Compare two secret hierarchies and compute diff rows.
 */
export function computeSecretDiff(
  itemsA: SecretItem[],
  itemsB: SecretItem[]
): SecretDiffRow[] {
  const mapA = new Map<string, SecretItem>();
  for (const item of itemsA) {
    mapA.set(item.key, item);
  }

  const mapB = new Map<string, SecretItem>();
  for (const item of itemsB) {
    mapB.set(item.key, item);
  }

  const allKeys = Array.from(new Set([...mapA.keys(), ...mapB.keys()])).sort();
  const rows: SecretDiffRow[] = [];

  for (const key of allKeys) {
    const itemA = mapA.get(key);
    const itemB = mapB.get(key);

    if (itemA && itemB) {
      const isMatch = itemA.value === itemB.value;
      rows.push({
        key,
        valueA: itemA.value,
        valueB: itemB.value,
        status: isMatch ? "MATCH" : "DIFF",
        typeA: itemA.type,
        typeB: itemB.type,
      });
    } else if (itemA && !itemB) {
      rows.push({
        key,
        valueA: itemA.value,
        status: "MISSING_IN_B",
        typeA: itemA.type,
      });
    } else if (!itemA && itemB) {
      rows.push({
        key,
        valueB: itemB.value,
        status: "MISSING_IN_A",
        typeB: itemB.type,
      });
    }
  }

  return rows;
}

/**
 * Fetch and diff two secret targets (AWS paths, local .env files, or encrypted .vault files).
 */
export async function diffSecretPaths(
  targetA: string,
  targetB: string,
  options: DiffOptions = {}
): Promise<{ rows: SecretDiffRow[]; formattedTable: string }> {
  const [itemsA, itemsB] = await Promise.all([
    loadSecrets(targetA, { ...options, passphrase: options.passphraseA || options.passphrase }),
    loadSecrets(targetB, { ...options, passphrase: options.passphraseB || options.passphrase }),
  ]);

  const rows = computeSecretDiff(itemsA, itemsB);
  const formattedTable = drawDiffTable(targetA, targetB, rows, options.showValues);

  return { rows, formattedTable };
}
