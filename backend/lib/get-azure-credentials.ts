/**
 * Helper to get Azure OpenAI credentials for local development
 * Uses az keyvault secret show for faster retrieval
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const KEY_VAULT_NAME = "kv-vegan-advocacy-86134";

// Cache for secrets (valid for session)
const secretCache = new Map<string, string>();

/**
 * Get secret from Azure Key Vault using Azure CLI (fast for local development)
 */
async function getSecretViaCLI(secretName: string): Promise<string> {
  // Check cache first
  if (secretCache.has(secretName)) {
    return secretCache.get(secretName)!;
  }

  try {
    const { stdout } = await execAsync(
      `az keyvault secret show --vault-name ${KEY_VAULT_NAME} --name ${secretName} --query value -o tsv`
    );

    const value = stdout.trim();

    if (!value) {
      throw new Error(`Secret ${secretName} is empty`);
    }

    // Cache the result
    secretCache.set(secretName, value);

    return value;
  } catch (error) {
    console.error(`Failed to retrieve secret ${secretName} via CLI:`, error);
    throw new Error(`Failed to retrieve Azure Key Vault secret: ${secretName}`);
  }
}

/**
 * Get Azure OpenAI configuration
 */
export async function getAzureOpenAIConfig() {
  // Run all three CLI commands in parallel
  const [endpoint, apiKey, deployment] = await Promise.all([
    getSecretViaCLI("AZURE-OPENAI-ENDPOINT"),
    getSecretViaCLI("AZURE-OPENAI-API-KEY"),
    getSecretViaCLI("AZURE-OPENAI-DEPLOYMENT"),
  ]);

  return {
    endpoint,
    apiKey,
    deployment,
  };
}
