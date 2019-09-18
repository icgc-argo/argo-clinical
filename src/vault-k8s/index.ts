import vault from 'node-vault';
import { promises } from 'fs';
let vaultClient: vault.Client;

async function login() {
  // if the app provided a token in the env use that
  const givenToken = process.env.VAULT_TOKEN;
  if (givenToken) {
    const options: vault.VaultOptions = {
      apiVersion: 'v1', // default
      endpoint: process.env.VAULT_URL || 'http://localhost:8200', // default
      token: givenToken,
    };
    vaultClient = vault(options);
    return;
  }

  // otherwise try and load the token from kubernetes
  const k8sToken = await promises.readFile(
    '/var/run/secrets/kubernetes.io/serviceaccount/token',
    'utf-8',
  );

  // exchange for a vault token
  const options: vault.VaultOptions = {
    apiVersion: 'v1', // default
    endpoint: process.env.VAULT_URL, // default
  };

  vaultClient = vault(options);
  const response = await vaultClient.kubernetesLogin({
    role: process.env.VAULT_ROLE,
    jwt: k8sToken,
  });

  const clientToken = response.auth.client_token as string;
  console.log(`login successful, token length: ${clientToken.length}`);
}

export async function loadSecret(key: string) {
  if (!vaultClient) {
    await login();
  }

  const result = await vaultClient.read(key);
  console.log(`loaded Secret ${key}`);
  return result.data.data;
}
