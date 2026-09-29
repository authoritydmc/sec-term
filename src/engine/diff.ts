import { SecretDiffRow, DiffOptions, SecretItem } from "../types.js";
import { fetchParametersByPath } from "../aws/ssm.js";
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
 * Fetch and diff two secret paths from AWS SSM Parameter Store.
 */
export async function diffSecretPaths(
  pathA: string,
  pathB: string,
  options: DiffOptions = {}
): Promise<{ rows: SecretDiffRow[]; formattedTable: string }> {
  const [itemsA, itemsB] = await Promise.all([
    fetchParametersByPath(pathA, options),
    fetchParametersByPath(pathB, options),
  ]);

  const rows = computeSecretDiff(itemsA, itemsB);
  const formattedTable = drawDiffTable(pathA, pathB, rows, options.showValues);

  return { rows, formattedTable };
}
