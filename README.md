# sec-term 🔒

[![CI](https://github.com/authoritydmc/sec-term/actions/workflows/ci.yml/badge.svg)](https://github.com/authoritydmc/sec-term/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/sec-term.svg?style=flat&color=brightgreen)](https://www.npmjs.com/package/sec-term)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

> **High-fidelity terminal manager for AWS Systems Manager (SSM) Parameter Store & Secrets Manager** supporting instant `.env` exports, cross-environment drift diffing, and zero-disk in-memory secret injection.

Eliminate the friction of clicking through AWS Console or writing custom scripts to sync environment variables. `sec-term` provides 1-command exports, visual drift diffs, in-memory process execution, and bulk uploads with KMS encryption.

---

## ✨ Core Features & Real-World Use Cases

### 1. 📥 Instant `.env` File Generation (`secx export`)
* **Problem**: Setting up a local development environment requires getting 25+ parameters from AWS into a `.env` file.
* **Solution**: Recursively pulls all parameters under `/app/dev/`, strips the path prefix, and exports a `.env` file with secure permissions (`0600`).
```bash
secx export /myapp/development/ --write .env
secx export /myapp/production/ --format json > config.json
```

---

### 2. 🔍 Cross-Environment Secret Drift Detector (`secx diff`)
* **Problem**: Production deployment crashes because an engineer added `NEW_API_KEY` to `/staging/` but forgot to add it to `/production/`.
* **Solution**: Visual side-by-side terminal comparison highlighting missing keys, extra keys, and mismatches with values masked by default.
```bash
secx diff /myapp/staging/ /myapp/production/
```
```text
┌─────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ Key / Variable  │ /myapp/staging/        │ /myapp/production/     │ Status   │
├─────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ DATABASE_URL    │ po***5432/staging_db   │ po***5432/prod_db      │ ≠ DIFF   │
│ STRIPE_KEY      │ sk***test_12345        │ sk***live_98765        │ ≠ DIFF   │
│ NEW_AI_FEATURE  │ enabled                │ [MISSING]              │ ✖ NO IN B│
│ REDIS_PORT      │ 6379                   │ 6379                   │ ✔ MATCH  │
└─────────────────┴────────────────────────┴────────────────────────┴──────────┘
```

---

### 3. 🚀 Zero-Disk In-Memory Secret Injection (`secx exec`)
* **Problem**: Committing `.env` files with real database credentials to Git or leaving plaintext production keys on developer laptops is a major security risk.
* **Solution**: Injects AWS parameters straight into process memory and executes your application or migrations without ever saving secrets to disk.
```bash
# Injects /myapp/dev/ secrets and starts local dev server
secx exec /myapp/dev/ -- npm run dev

# Run Prisma/TypeORM migrations with production secrets in memory
secx exec /myapp/production/ -- npx prisma migrate deploy
```

---

### 4. 📤 Bulk `.env` Importer (`secx import`)
* **Problem**: Creating 20 encrypted AWS SSM parameters manually via AWS CLI or Console takes 20 minutes.
* **Solution**: Batch-imports an entire `.env` file into encrypted `SecureString` SSM parameters with 1 command.
```bash
# Preview what would be created without writing to AWS
secx import /myapp/staging/ .env.staging --dry-run

# Upload all keys as KMS encrypted SecureString parameters
secx import /myapp/staging/ .env.staging --secure
```

---

### 5. 🌲 Interactive Parameter Store Tree (`secx tree`)
* **Problem**: Finding parameters across multiple AWS microservices is painful.
* **Solution**: Colorized hierarchy view with KMS encryption status, versions, and paths.
```bash
secx tree /myapp/
```

---

## 🚀 Installation

### Global CLI Tool
```bash
npm install -g sec-term
# or run directly with npx
npx sec-term --help
# or short alias
npx secx --help
```

### In Your Project (Library)
```bash
npm install sec-term
```

---

## 📖 Programmatic API (TypeScript & JavaScript)

```typescript
import { fetchParametersByPath, diffSecretPaths, exportSecrets } from "sec-term";

// 1. Fetch Decrypted Key-Value Map
const items = await fetchParametersByPath("/myapp/production/");
for (const item of items) {
  console.log(`${item.key} (${item.type})`);
}

// 2. Export Formatted .env
const dotenvString = await exportSecrets("/myapp/staging/", { format: "env" });
console.log(dotenvString);

// 3. Diff Two Paths Programmatically
const { rows } = await diffSecretPaths("/myapp/staging/", "/myapp/production/");
const missingInProd = rows.filter((r) => r.status === "MISSING_IN_B");
console.log("Missing in Prod:", missingInProd.map((r) => r.key));
```

---

## ⚙️ CLI Commands & Options

| Command | Arguments | Options | Description |
| :--- | :--- | :--- | :--- |
| `export` | `<path>` | `-f, --format <env\|json\|yaml>`, `-w, --write <file>` | Export hierarchy to format |
| `diff` | `<pathA> <pathB>` | `--show-values` | Compare two secret paths |
| `exec` | `<path> -- <cmd>` | `--region <region>` | Run command with in-memory secrets |
| `import` | `<path> <file>` | `--secure`, `--kms-key-id <key>`, `--dry-run` | Bulk upload `.env` to SSM |
| `get` | `<path>` | `--region <region>` | Retrieve single parameter value |
| `set` | `<path> <value>` | `--secure`, `--type <type>`, `--kms-key-id <key>` | Set single parameter |
| `tree` | `[path]` | `--region <region>` | Visual hierarchy of paths |

---

## 🧪 Development & Testing

```bash
git clone https://github.com/authoritydmc/sec-term.git
cd sec-term
npm install
npm test
npm run build
```

---

## 🚀 Automated Release & Versioning

### 1-Click from GitHub Actions
Go to **Actions** -> **Automated Version & Release** -> Select `patch`, `minor`, or `major` -> Click **Run workflow**.

### From Terminal
```bash
npm run release:patch
npm run release:minor
npm run release:major
```

---

## 📄 License

[MIT](LICENSE) © 2026 authoritydmc
