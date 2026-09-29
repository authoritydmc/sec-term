export type ParameterType = "String" | "StringList" | "SecureString" | "SecretsManager";

export interface SecretItem {
  key: string; // Clean key (e.g. DATABASE_URL)
  fullPath: string; // Full AWS path (e.g. /app/prod/DATABASE_URL)
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
}

export interface ExportOptions extends ClientOptions {
  format?: "env" | "json" | "yaml";
  showValues?: boolean;
  prefix?: string;
}

export interface DiffOptions extends ClientOptions {
  showValues?: boolean;
}

export interface ImportOptions extends ClientOptions {
  secure?: boolean;
  overwrite?: boolean;
  kmsKeyId?: string;
  dryRun?: boolean;
}
