# 🔐 sec-term (`secx`)

> **High-Fidelity Terminal Secrets Manager for AWS SSM Parameter Store & Zero-Cloud Local Encrypted Vaults.**
> Instant `.env` export, cross-environment drift diffing, zero-disk in-memory secret injection, and AES-256-GCM local vault management.

[![CI](https://github.com/authoritydmc/sec-term/actions/workflows/ci.yml/badge.svg)](https://github.com/authoritydmc/sec-term/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/sec-term.svg?style=flat-square&color=cb3837)](https://www.npmjs.com/package/sec-term)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org)

---

## ⚡ Highlights

- 🌐 **AWS SSM Parameter Store & LocalStack**: Recursively query and export parameters with automatic KMS decryption.
- 💻 **Zero-Cloud & Offline Ready**: Works completely without AWS! Diff local `.env` files (`.env.local` vs `.env.prod`) and run applications with local files safely.
- 🔒 **Zero-Cloud Encrypted Vaults (`.secx.vault`)**: Encrypt production `.env` files with AES-256-GCM authenticated encryption (PBKDF2 100k iterations).
- 🔍 **Visual Drift Diffing**: High-fidelity Unicode tables comparing variables between staging/production or local `.env` files.
- 🚀 **Zero-Disk In-Memory Execution**: Pull secrets from SSM or encrypted vaults directly into memory child processes without writing plaintext credentials to disk.

---

## 📦 Installation

Install globally or run instantly via `npx`:

```bash
# Run instantly with zero install
npx sec-term --help
npx secx --help

# Or install globally
npm install -g sec-term
```

---

## 🛠️ Real-World Use Cases & Expected Outputs

### Use Case 1: Pre-Deploy Environment Configuration Diffing (Zero-Cloud)
**Problem**: A production deployment crashes because a new variable (`STRIPE_WEBHOOK_SECRET`) was added to `.env.staging` but forgotten in `.env.production`.  
**Solution**: Run `secx diff` before deploying to catch configuration drift.

```bash
secx diff .env.staging .env.production
```

**Expected Output**:
```text
🔍 Secret Drift Analysis
  Target A: .env.staging
  Target B: .env.production

┌──────────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ Key / Variable       │ .env.staging           │ .env.production        │ Status   │
├──────────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ DATABASE_URL         │ po***db                │ po***db                │ ✔ MATCH  │
│ PORT                 │ 3000                   │ 3000                   │ ✔ MATCH  │
│ STRIPE_WEBHOOK_SECRET│ wh***99                │ [MISSING]              │ ✖ NO IN B│
└──────────────────────┴────────────────────────┴────────────────────────┴──────────┘

⚠ Detected 1 configuration drift(s) between targets.
```

---

### Use Case 2: Zero-Disk In-Memory Secret Execution
**Problem**: Writing unencrypted `.env` files to production servers risks secrets being leaked in git commits, logs, or disk forensics.  
**Solution**: Inject secrets directly from an encrypted `.vault` or AWS SSM hierarchy into memory:

```bash
# Run server with in-memory secrets (zero plaintext written to disk)
secx exec secrets.vault --passphrase "my-vault-passphrase" -- npm start
```

**Expected Output**:
```text
> my-app@1.0.0 start
> node server.js
[Server] Connected to Database with injected in-memory credentials (PID 14920).
[Server] Listening on http://localhost:3000
```

---

### Use Case 3: Encrypting `.env` Files into Local Git-Safe Vaults
**Problem**: Developers need a secure way to share production `.env` configurations via Git without exposing plaintext.  
**Solution**: Encrypt `.env.production` into an AES-256-GCM authenticated vault file (`.secx.vault`):

```bash
secx vault encrypt .env.production -o secrets.vault --passphrase "strong-team-passphrase"
```

**Expected Output**:
```text
✔ Encrypted '.env.production' into 'secrets.vault' (AES-256-GCM)
```

To decrypt on another machine or CI runner:
```bash
secx vault decrypt secrets.vault -o .env.production --passphrase "strong-team-passphrase"
```

---

### Use Case 4: Pull AWS SSM Hierarchy to `.env` or JSON
**Problem**: Syncing remote AWS SSM Parameter Store hierarchies to local development.  
**Solution**:

```bash
# Export /prod/api/ hierarchy to .env format
secx export /prod/api/

# Export directly to file
secx export /prod/api/ -f env -w .env.production

# Export to JSON
secx export /prod/api/ -f json
```

**Expected Output**:
```bash
DATABASE_URL="postgres://admin:secret@db.rds.amazonaws.com:5432/app"
REDIS_URL="rediss://default:token@redis.prod.cache.amazonaws.com:6379"
NODE_ENV=production
```

---

## ⚙️ CLI Options Reference

```text
Usage: sec-term [options] [command]

Commands:
  export [options] <target>           Export secrets from AWS SSM or local files (.env / .vault)
  diff [options] <targetA> <targetB>  Compare two secret targets and highlight drift
  exec [options] <target> <cmd...>    Execute a command with secrets injected into memory
  vault encrypt [options] <envFile>   Encrypt a plaintext .env file (AES-256-GCM)
  vault decrypt [options] <vaultFile> Decrypt a .vault file back to plaintext
  import [options] <path> <file>      Upload local .env into AWS SSM Parameter Store
  get [options] <path>                Retrieve value of a single AWS SSM parameter
  set [options] <path> <value>        Create or update an AWS SSM parameter
```

---

## 📄 License

MIT © 2026 authoritydmc
