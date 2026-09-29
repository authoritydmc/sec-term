import {
  SSMClient,
  GetParametersByPathCommand,
  GetParameterCommand,
  PutParameterCommand,
  DeleteParameterCommand,
} from "@aws-sdk/client-ssm";
import { SecretItem, ClientOptions, ParameterType } from "../types.js";

export function getSSMClient(options: ClientOptions = {}): SSMClient {
  return new SSMClient({
    region: options.region || process.env.AWS_REGION || "us-east-1",
  });
}

/**
 * Recursively fetch all parameters under a path prefix with automatic decryption.
 */
export async function fetchParametersByPath(
  pathPrefix: string,
  options: ClientOptions = {}
): Promise<SecretItem[]> {
  const client = getSSMClient(options);
  const normalizedPrefix = pathPrefix.endsWith("/") ? pathPrefix : `${pathPrefix}/`;

  const items: SecretItem[] = [];
  let nextToken: string | undefined;

  do {
    const command = new GetParametersByPathCommand({
      Path: normalizedPrefix,
      Recursive: true,
      WithDecryption: true,
      NextToken: nextToken,
    });

    const res = await client.send(command);

    if (res.Parameters) {
      for (const p of res.Parameters) {
        if (!p.Name) continue;

        // Clean key: strip the path prefix
        const cleanKey = p.Name.startsWith(normalizedPrefix)
          ? p.Name.slice(normalizedPrefix.length).replace(/^\/+/, "")
          : p.Name;

        items.push({
          key: cleanKey,
          fullPath: p.Name,
          value: p.Value || "",
          type: (p.Type as ParameterType) || "String",
          version: p.Version,
          lastModifiedDate: p.LastModifiedDate,
        });
      }
    }

    nextToken = res.NextToken;
  } while (nextToken);

  return items;
}

/**
 * Fetch a single parameter by full name.
 */
export async function fetchSingleParameter(
  name: string,
  options: ClientOptions = {}
): Promise<SecretItem> {
  const client = getSSMClient(options);
  const command = new GetParameterCommand({
    Name: name,
    WithDecryption: true,
  });

  const res = await client.send(command);
  if (!res.Parameter) {
    throw new Error(`Parameter '${name}' not found.`);
  }

  const p = res.Parameter;
  const key = p.Name?.split("/").pop() || p.Name || name;

  return {
    key,
    fullPath: p.Name || name,
    value: p.Value || "",
    type: (p.Type as ParameterType) || "String",
    version: p.Version,
    lastModifiedDate: p.LastModifiedDate,
  };
}

/**
 * Put or update a parameter in AWS SSM Parameter Store.
 */
export async function putParameter(
  name: string,
  value: string,
  type: ParameterType = "SecureString",
  options: { overwrite?: boolean; kmsKeyId?: string } & ClientOptions = {}
): Promise<number> {
  const client = getSSMClient(options);
  const command = new PutParameterCommand({
    Name: name,
    Value: value,
    Type: type === "SecretsManager" ? "SecureString" : type,
    Overwrite: options.overwrite !== false,
    KeyId: options.kmsKeyId,
  });

  const res = await client.send(command);
  return res.Version || 1;
}

/**
 * Delete a parameter from SSM.
 */
export async function deleteParameter(
  name: string,
  options: ClientOptions = {}
): Promise<void> {
  const client = getSSMClient(options);
  const command = new DeleteParameterCommand({
    Name: name,
  });
  await client.send(command);
}
