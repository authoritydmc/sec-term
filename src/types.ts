export type ParameterType = "String" | "StringList" | "SecureString" | "SecretsManager" | "File" | "Vault";

export interface SecretItem {
  key: string; // Clean key (e.g. DATABASE_URL)
  fullPath: string; // Full path or file location (e.g. /app/prod/DATABASE_URL or .env.staging)
  value: string;
  type: ParameterType;
  version?: number;
  lastModifiedDate?: Date;
  description?: string;
  kmsKeyId?: string;
}

export type DiffStatus = "MATCH" | "DIFF" | "MISSING_IN_A" | "MISSING_IN_B";

export interface SecretDiffRow {
  key: string;
  valueA?: string;
  valueB?: string;
  status: DiffStatus;
  typeA?: ParameterType;
  typeB?: ParameterType;
}

export interface ClientOptions {
  region?: string;
  profile?: string;
  endpoint?: string; // Custom endpoint for LocalStack / MinIO / local AWS mocks
  passphrase?: string; // For encrypted local vaults (.secx.vault)
}

export interface ExportOptions extends ClientOptions {
  format?: "env" | "json" | "yaml";
  showValues?: boolean;
  prefix?: string;
}

export interface DiffOptions extends ClientOptions {
  showValues?: boolean;
  passphraseA?: string;
  passphraseB?: string;
}

export interface ImportOptions extends ClientOptions {
  secure?: boolean;
  overwrite?: boolean;
  kmsKeyId?: string;
  dryRun?: boolean;
}
