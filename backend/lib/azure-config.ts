/**
 * Azure Configuration Service
 * Retrieves secrets from Azure Key Vault using Managed Identity
 */

import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";

const KEY_VAULT_NAME = "kv-vegan-advocacy-86134";
const vaultUrl = `https://${KEY_VAULT_NAME}.vault.azure.net`;

// Cache for secrets to avoid repeated Key Vault calls
const secretCache = new Map<string, { value: string; timestamp: number }>();
const CACHE_TTL = 3600000; // 1 hour in milliseconds

/**
 * Get a secret from Azure Key Vault with caching
 */
async function getSecret(secretName: string): Promise<string> {
  // Check cache first
  const cached = secretCache.get(secretName);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value;
  }

  // Retrieve from Key Vault
  const credential = new DefaultAzureCredential();
  const client = new SecretClient(vaultUrl, credential);

  try {
    const secret = await client.getSecret(secretName);

    if (!secret.value) {
      throw new Error(`Secret ${secretName} has no value`);
    }

    // Cache the result
    secretCache.set(secretName, {
      value: secret.value,
      timestamp: Date.now(),
    });

    return secret.value;
  } catch (error) {
    console.error(`Failed to retrieve secret ${secretName}:`, error);
    throw new Error(`Failed to retrieve Azure Key Vault secret: ${secretName}`);
  }
}

/**
 * Get Azure OpenAI configuration
 */
export async function getAzureOpenAIConfig() {
  const [endpoint, apiKey, deployment] = await Promise.all([
    getSecret("AZURE-OPENAI-ENDPOINT"),
    getSecret("AZURE-OPENAI-API-KEY"),
    getSecret("AZURE-OPENAI-DEPLOYMENT"),
  ]);

  return {
    endpoint,
    apiKey,
    deployment,
  };
}
