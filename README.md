# 🔐 sec-term (`secx`)

> **High-Fidelity Terminal Secrets Manager for AWS SSM Parameter Store & Zero-Cloud Local Encrypted Vaults.**
> Instant `.env` export, cross-environment drift diffing, zero-disk in-memory secret execution, and AES-256-GCM local vault management.

[![npm version](https://img.shields.io/npm/v/sec-term.svg?style=flat-square&color=cb3837)](https://www.npmjs.com/package/sec-term)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)

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

## 🚀 Usage Guide

### 1. Zero-Cloud / Offline Mode (No AWS Required)

#### 🔍 Compare Drift Between Two Local `.env` Files
Spot missing keys or differences between staging and production configs before deploying:
```bash
secx diff .env.staging .env.production
```

#### 🔒 Encrypt a `.env` File into an Encrypted Vault
```bash
secx vault encrypt .env.production -o secrets.vault --passphrase "my-secure-passphrase"
```

#### 🔓 Decrypt a Vault File
```bash
# Print to terminal
secx vault decrypt secrets.vault --passphrase "my-secure-passphrase"

# Or write back to .env
secx vault decrypt secrets.vault -o .env.production --passphrase "my-secure-passphrase"
```

#### 🚀 Execute with Zero-Disk Injected Secrets (Local Vault)
Run your application with secrets loaded in-memory directly from the encrypted vault:
```bash
secx exec secrets.vault --passphrase "my-secure-passphrase" -- npm start
```

---

### 2. AWS Mode (SSM Parameter Store & LocalStack)

#### 📤 Export AWS Hierarchy to `.env`, JSON, or YAML
```bash
# Export /prod/api/ hierarchy to .env format
secx export /prod/api/

# Export to a file directly
secx export /prod/api/ -f env -w .env.production

# Export to JSON or YAML
secx export /prod/api/ -f json
secx export /prod/api/ -f yaml

# LocalStack support (offline mock)
secx export /dev/api/ --endpoint http://localhost:4566
```

#### 🔍 Cross-Environment Drift Diffing
```bash
# Compare staging vs prod parameters on AWS
secx diff /staging/api/ /prod/api/

# Reveal raw values
secx diff /staging/api/ /prod/api/ --show-values
```

#### 🚀 Run App with Zero Plaintext on Disk
```bash
secx exec /prod/api/ -- npm start
secx exec /prod/api/ -- python main.py
```

#### 📥 Import `.env` into AWS Parameter Store
```bash
# Preview what would be uploaded
secx import /prod/api/ .env.production --dry-run

# Upload as KMS SecureString
secx import /prod/api/ .env.production --secure
```

#### 🌲 Visual Hierarchy Tree
```bash
secx tree /prod/
```

---

## 🛡️ License

MIT © [authoritydmc](https://github.com/authoritydmc)
