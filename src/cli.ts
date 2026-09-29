import { Command } from "commander";
import { exportSecrets } from "./engine/export.js";
import { diffSecretPaths } from "./engine/diff.js";
import { importSecretsFromFile } from "./engine/import.js";
import { loadSecrets } from "./engine/loader.js";
import { fetchSingleParameter, putParameter } from "./aws/ssm.js";
import { encryptEnvFile, decryptVaultFile } from "./vault/crypto.js";
import { spawn } from "child_process";
import fs from "fs";
import picocolors from "picocolors";

async function main() {
  const program = new Command();

  program
    .name("sec-term")
    .description(
      "High-fidelity terminal secrets manager for AWS SSM Parameter Store & local zero-cloud encrypted vaults."
    )
    .version("1.1.0", "-v, --version", "Output current version");

  // 1. Export Command
  program
    .command("export <target>")
    .description("Export secrets from AWS SSM path, local .env, or encrypted .vault to .env, JSON, or YAML")
    .option("-f, --format <type>", "Output format: env, json, yaml", "env")
    .option("-w, --write <file>", "Write output directly to a file")
    .option("--passphrase <key>", "Passphrase for encrypted .vault files")
    .option("--region <region>", "AWS region")
    .option("--endpoint <url>", "Custom endpoint (e.g. http://localhost:4566 for LocalStack)")
    .action(async (target, options) => {
      try {
        const output = await exportSecrets(target, {
          format: options.format,
          region: options.region,
          endpoint: options.endpoint,
          passphrase: options.passphrase,
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

  // 2. Diff Command (Multi-target: AWS SSM paths or local files)
  program
    .command("diff <targetA> <targetB>")
    .description("Compare two secret targets (SSM paths, local .env files, or .vault files) and highlight drift")
    .option("--show-values", "Display raw unmasked values instead of masked placeholders", false)
    .option("--passphrase <key>", "Passphrase for encrypted .vault files")
    .option("--passphrase-a <key>", "Passphrase for target A if encrypted")
    .option("--passphrase-b <key>", "Passphrase for target B if encrypted")
    .option("--region <region>", "AWS region")
    .option("--endpoint <url>", "Custom endpoint for AWS/LocalStack")
    .action(async (targetA, targetB, options) => {
      try {
        const { formattedTable, rows } = await diffSecretPaths(targetA, targetB, {
          showValues: options.showValues,
          passphraseA: options.passphraseA || options.passphrase,
          passphraseB: options.passphraseB || options.passphrase,
          region: options.region,
          endpoint: options.endpoint,
        });

        console.log(`\n${picocolors.bold("🔍 Secret Drift Analysis")}`);
        console.log(`  ${picocolors.cyan("Target A:")} ${targetA}`);
        console.log(`  ${picocolors.cyan("Target B:")} ${targetB}\n`);
        console.log(formattedTable);

        const diffs = rows.filter((r) => r.status !== "MATCH");
        if (diffs.length > 0) {
          console.log(`\n${picocolors.yellow(`⚠ Detected ${diffs.length} configuration drift(s) between targets.`)}\n`);
        } else {
          console.log(`\n${picocolors.green("✔ All variables match across both targets!")}\n`);
        }
      } catch (err: any) {
        console.error(picocolors.red(`✖ Error: ${err.message || err}`));
        process.exit(1);
      }
    });

  // 3. Exec Command (Zero-Disk In-Memory Injection from AWS, .env, or .vault)
  program
    .command("exec <target>")
    .description("Execute a command with secrets pulled directly into memory without saving to disk")
    .option("--passphrase <key>", "Passphrase for encrypted .vault files")
    .option("--region <region>", "AWS region")
    .option("--endpoint <url>", "Custom endpoint for AWS/LocalStack")
    .argument("<command...>", "Command to execute with injected secrets")
    .action(async (target, cmdArgs, options) => {
      try {
        const items = await loadSecrets(target, {
          region: options.region,
          endpoint: options.endpoint,
          passphrase: options.passphrase,
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

  // 4. Local Vault Commands (Zero-Cloud AES-256-GCM Encryption)
  const vaultCmd = program.command("vault").description("Manage zero-cloud AES-256-GCM encrypted secret vaults");

  vaultCmd
    .command("encrypt <envFile>")
    .description("Encrypt a plaintext .env file into a secure .vault file")
    .option("-o, --output <file>", "Output encrypted vault file path", ".secx.vault")
    .option("-p, --passphrase <key>", "Passphrase to encrypt with (or prompts/uses SECX_VAULT_PASSPHRASE)")
    .action((envFile, options) => {
      try {
        const passphrase = options.passphrase || process.env.SECX_VAULT_PASSPHRASE || process.env.VAULT_PASSWORD;
        if (!passphrase) {
          console.error(picocolors.red("✖ Error: Passphrase required. Provide via --passphrase or SECX_VAULT_PASSPHRASE."));
          process.exit(1);
        }

        encryptEnvFile(envFile, options.output, passphrase);
        console.log(picocolors.green(`✔ Encrypted '${envFile}' into '${options.output}' (AES-256-GCM)`));
      } catch (err: any) {
        console.error(picocolors.red(`✖ Error: ${err.message || err}`));
        process.exit(1);
      }
    });

  vaultCmd
    .command("decrypt <vaultFile>")
    .description("Decrypt a .vault file back to plaintext .env or stdout")
    .option("-o, --output <file>", "Output decrypted .env file path")
    .option("-p, --passphrase <key>", "Passphrase to decrypt with")
    .action((vaultFile, options) => {
      try {
        const passphrase = options.passphrase || process.env.SECX_VAULT_PASSPHRASE || process.env.VAULT_PASSWORD;
        if (!passphrase) {
          console.error(picocolors.red("✖ Error: Passphrase required. Provide via --passphrase or SECX_VAULT_PASSPHRASE."));
          process.exit(1);
        }

        const decrypted = decryptVaultFile(vaultFile, passphrase, options.output);
        if (options.output) {
          console.log(picocolors.green(`✔ Decrypted '${vaultFile}' into '${options.output}'`));
        } else {
          process.stdout.write(decrypted);
        }
      } catch (err: any) {
        console.error(picocolors.red(`✖ Error: ${err.message || err}`));
        process.exit(1);
      }
    });

  // 5. Import Command (Upload .env or JSON to AWS SSM)
  program
    .command("import <path> <file>")
    .description("Import a local .env or JSON file into AWS SSM Parameter Store")
    .option("--secure", "Upload as KMS encrypted SecureString", true)
    .option("--no-secure", "Upload as plaintext String")
    .option("--overwrite", "Overwrite existing parameters", true)
    .option("--kms-key-id <key>", "Custom KMS Key ID or Alias for encryption")
    .option("--dry-run", "Preview parameters to upload without writing to AWS", false)
    .option("--region <region>", "AWS region")
    .option("--endpoint <url>", "Custom endpoint for AWS/LocalStack")
    .action(async (pathPrefix, filePath, options) => {
      try {
        const result = await importSecretsFromFile(pathPrefix, filePath, {
          secure: options.secure,
          overwrite: options.overwrite,
          kmsKeyId: options.kmsKeyId,
          dryRun: options.dryRun,
          region: options.region,
          endpoint: options.endpoint,
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

  // 6. Get Single Parameter
  program
    .command("get <path>")
    .description("Retrieve the value of a single parameter from AWS SSM")
    .option("--region <region>", "AWS region")
    .option("--endpoint <url>", "Custom endpoint for AWS/LocalStack")
    .action(async (name, options) => {
      try {
        const item = await fetchSingleParameter(name, { region: options.region, endpoint: options.endpoint });
        console.log(item.value);
      } catch (err: any) {
        console.error(picocolors.red(`✖ Error: ${err.message || err}`));
        process.exit(1);
      }
    });

  // 7. Set Single Parameter
  program
    .command("set <path> <value>")
    .description("Create or update a single parameter in AWS SSM Parameter Store")
    .option("--secure", "Store as SecureString", true)
    .option("--type <type>", "Parameter type (String, StringList, SecureString)", "SecureString")
    .option("--kms-key-id <key>", "KMS Key ID or Alias")
    .option("--region <region>", "AWS region")
    .option("--endpoint <url>", "Custom endpoint for AWS/LocalStack")
    .action(async (name, value, options) => {
      try {
        const type = options.secure ? "SecureString" : options.type;
        const version = await putParameter(name, value, type, {
          kmsKeyId: options.kmsKeyId,
          region: options.region,
          endpoint: options.endpoint,
        });
        console.log(picocolors.green(`✔ Successfully saved parameter '${name}' (version ${version})`));
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
