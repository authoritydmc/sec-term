import picocolors from "picocolors";
import { SecretDiffRow } from "../types.js";

export function maskValue(val: string | undefined): string {
  if (val === undefined) return "[MISSING]";
  if (val.length === 0) return "[EMPTY]";
  if (val.length <= 4) return "****";
  return `${val.slice(0, 2)}***${val.slice(-2)}`;
}

export function drawDiffTable(
  titleA: string,
  titleB: string,
  rows: SecretDiffRow[],
  showValues: boolean = false
): string {
  const colKeyLen = Math.max(16, ...rows.map((r) => r.key.length));
  const colValLen = 22;

  const header = `┌─${"─".repeat(colKeyLen)}─┬─${"─".repeat(colValLen)}─┬─${"─".repeat(colValLen)}─┬──────────┐`;
  const footer = `└─${"─".repeat(colKeyLen)}─┴─${"─".repeat(colValLen)}─┴─${"─".repeat(colValLen)}─┴──────────┘`;
  const divider = `├─${"─".repeat(colKeyLen)}─┼─${"─".repeat(colValLen)}─┼─${"─".repeat(colValLen)}─┼──────────┤`;

  const pad = (str: string, len: number) => {
    const clean = str.replace(/\x1b\[[0-9;]*m/g, "");
    const diff = Math.max(0, len - clean.length);
    return str + " ".repeat(diff);
  };

  const lines: string[] = [
    header,
    `│ ${pad(picocolors.bold("Key / Variable"), colKeyLen)} │ ${pad(picocolors.bold(titleA), colValLen)} │ ${pad(picocolors.bold(titleB), colValLen)} │ ${pad(picocolors.bold("Status"), 8)} │`,
    divider,
  ];

  for (const r of rows) {
    const valA = showValues ? (r.valueA ?? "[MISSING]") : maskValue(r.valueA);
    const valB = showValues ? (r.valueB ?? "[MISSING]") : maskValue(r.valueB);

    let statusBadge = "";
    if (r.status === "MATCH") {
      statusBadge = picocolors.green("✔ MATCH");
    } else if (r.status === "DIFF") {
      statusBadge = picocolors.yellow("≠ DIFF");
    } else if (r.status === "MISSING_IN_A") {
      statusBadge = picocolors.red("✖ NO IN A");
    } else if (r.status === "MISSING_IN_B") {
      statusBadge = picocolors.red("✖ NO IN B");
    }

    const shortValA = valA.length > colValLen ? valA.slice(0, colValLen - 3) + "..." : valA;
    const shortValB = valB.length > colValLen ? valB.slice(0, colValLen - 3) + "..." : valB;

    lines.push(
      `│ ${pad(picocolors.cyan(r.key), colKeyLen)} │ ${pad(r.valueA === undefined ? picocolors.dim(shortValA) : shortValA, colValLen)} │ ${pad(r.valueB === undefined ? picocolors.dim(shortValB) : shortValB, colValLen)} │ ${pad(statusBadge, 8)} │`
    );
  }

  lines.push(footer);
  return lines.join("\n");
}
