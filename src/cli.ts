import { Command } from "commander";
import { exportSecrets } from "./engine/export.js";
import { diffSecretPaths } from "./engine/diff.js";
import { importSecretsFromFile } from "./engine/import.js";
import { fetchParametersByPath, fetchSingleParameter, putParameter, deleteParameter } from "./aws/ssm.js";
import { spawn } from "child_process";
import fs from "fs";
import picocolors from "picocolors";

async function main() {
  const program = new Command();

  program
    .name("sec-term")
    .description(
      "High-fidelity terminal manager for AWS SSM Parameter Store & Secrets Manager."
    )
    .version("1.0.0", "-v, --version", "Output current version");

  // 1. Export Command
  program
    .command("export <path>")
    .description("Export secrets under a path hierarchy to .env, JSON, or YAML")
    .option("-f, --format <type>", "Output format: env, json, yaml", "env")
    .option("-w, --write <file>", "Write output directly to a file")
    .option("--region <region>", "AWS region")
    .action(async (pathPrefix, options) => {
      try {
        const output = await exportSecrets(pathPrefix, {
          format: options.format,
          region: options.region,
        });

        if (options.write) {
          fs.writeFileSync(options.write, output, { mode: 0o600 });
          console.log(picocolors.green(`✔ Successfully exported secrets to ${options.write}`));
        } else {
          process.stdout.write(output);
        }
      } catch (err: any) {
        console.error(picocolors.red(`✖ Error: ${err.message || err}`));
        process.exit(1);
      }
    });

  // 2. Diff Command
  program
    .command("diff <pathA> <pathB>")
    .description("Compare two secret hierarchies and highlight drift, missing keys, and value matches")
    .option("--show-values", "Display raw unmasked values instead of masked placeholders", false)
    .option("--region <region>", "AWS region")
    .action(async (pathA, pathB, options) => {
      try {
        const { formattedTable, rows } = await diffSecretPaths(pathA, pathB, {
          showValues: options.showValues,
          region: options.region,
        });

        console.log(`\n${picocolors.bold("🔍 Secret Drift Analysis")}`);
        console.log(`  ${picocolors.cyan("Path A:")} ${pathA}`);
        console.log(`  ${picocolors.cyan("Path B:")} ${pathB}\n`);
        console.log(formattedTable);

        const diffs = rows.filter((r) => r.status !== "MATCH");
        if (diffs.length > 0) {
          console.log(`\n${picocolors.yellow(`⚠ Detected ${diffs.length} configuration drift(s) between environments.`)}\n`);
        } else {
          console.log(`\n${picocolors.green("✔ All variables match across both environments!")}\n`);
        }
      } catch (err: any) {
        console.error(picocolors.red(`✖ Error: ${err.message || err}`));
        process.exit(1);
      }
    });

  // 3. Exec Command (Zero-Disk In-Memory Injection)
  program
    .command("exec <path>")
    .description("Execute a command with secrets pulled directly into memory without saving to disk")
    .option("--region <region>", "AWS region")
    .argument("<command...>", "Command to execute with injected secrets")
    .action(async (pathPrefix, cmdArgs, options) => {
      try {
        const items = await fetchParametersByPath(pathPrefix, {
          region: options.region,
        });

        const injectedEnv: Record<string, string> = { ...process.env as Record<string, string> };
        for (const item of items) {
          injectedEnv[item.key] = item.value;
        }

        const [cmd, ...args] = cmdArgs;
        const child = spawn(cmd, args, {
          stdio: "inherit",
          env: injectedEnv,
        });

        child.on("exit", (code) => {
          process.exit(code || 0);
        });
      } catch (err: any) {
        console.error(picocolors.red(`✖ Error: ${err.message || err}`));
        process.exit(1);
      }
    });

  // 4. Import Command
  program
    .command("import <path> <file>")
    .description("Import a local .env or JSON file into AWS SSM Parameter Store")
    .option("--secure", "Upload as KMS encrypted SecureString", true)
    .option("--no-secure", "Upload as plaintext String")
    .option("--overwrite", "Overwrite existing parameters", true)
    .option("--kms-key-id <key>", "Custom KMS Key ID or Alias for encryption")
    .option("--dry-run", "Preview parameters to upload without writing to AWS", false)
    .option("--region <region>", "AWS region")
    .action(async (pathPrefix, filePath, options) => {
      try {
        const result = await importSecretsFromFile(pathPrefix, filePath, {
          secure: options.secure,
          overwrite: options.overwrite,
          kmsKeyId: options.kmsKeyId,
          dryRun: options.dryRun,
          region: options.region,
        });

        if (options.dryRun) {
          console.log(picocolors.yellow(`\n[DRY RUN] Would upload ${result.total} parameter(s):`));
          for (const k of result.uploaded) {
            console.log(`  • ${k}`);
          }
          return;
        }

        console.log(picocolors.green(`\n✔ Successfully uploaded ${result.uploaded.length}/${result.total} parameters.`));
        if (result.errors.length > 0) {
          console.log(picocolors.red(`\n✖ ${result.errors.length} error(s) occurred:`));
          for (const e of result.errors) {
            console.log(`  • ${e.key}: ${e.error}`);
          }
        }
      } catch (err: any) {
        console.error(picocolors.red(`✖ Error: ${err.message || err}`));
        process.exit(1);
      }
    });

  // 5. Get Single Parameter
  program
    .command("get <path>")
    .description("Retrieve the value of a single parameter")
    .option("--region <region>", "AWS region")
    .action(async (name, options) => {
      try {
        const item = await fetchSingleParameter(name, { region: options.region });
        console.log(item.value);
      } catch (err: any) {
        console.error(picocolors.red(`✖ Error: ${err.message || err}`));
        process.exit(1);
      }
    });

  // 6. Set Single Parameter
  program
    .command("set <path> <value>")
    .description("Create or update a single parameter in AWS SSM Parameter Store")
    .option("--secure", "Store as SecureString", true)
    .option("--type <type>", "Parameter type (String, StringList, SecureString)", "SecureString")
    .option("--kms-key-id <key>", "KMS Key ID or Alias")
    .option("--region <region>", "AWS region")
    .action(async (name, value, options) => {
      try {
        const type = options.secure ? "SecureString" : options.type;
        const version = await putParameter(name, value, type, {
          kmsKeyId: options.kmsKeyId,
          region: options.region,
        });
        console.log(picocolors.green(`✔ Successfully saved parameter '${name}' (version ${version})`));
      } catch (err: any) {
        console.error(picocolors.red(`✖ Error: ${err.message || err}`));
        process.exit(1);
      }
    });

  // 7. Tree / List Hierarchy
  program
    .command("tree [path]")
    .description("Display an interactive visual tree of parameter paths")
    .option("--region <region>", "AWS region")
    .action(async (pathPrefix = "/", options) => {
      try {
        const items = await fetchParametersByPath(pathPrefix, { region: options.region });
        if (items.length === 0) {
          console.log(picocolors.yellow(`No parameters found under '${pathPrefix}'`));
          return;
        }

        console.log(`\n${picocolors.bold(`🌲 AWS Parameter Store Hierarchy (${pathPrefix})`)}\n`);
        for (const item of items) {
          const typeBadge = item.type === "SecureString" ? picocolors.green("[Secure]") : picocolors.cyan(`[${item.type}]`);
          const versionStr = item.version ? picocolors.dim(`(v${item.version})`) : "";
          console.log(`  • ${typeBadge} ${picocolors.bold(item.fullPath)} ${versionStr}`);
        }
        console.log("");
      } catch (err: any) {
        console.error(picocolors.red(`✖ Error: ${err.message || err}`));
        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
