import vault from "node-vault";

let vaultClient: vault.Client;

async function login() {
  // if the app provided a token in the env use that
  let givenToken = process.env.VAULT_TOKEN;
  if (givenToken) {
    const options: vault.VaultOptions = {
      apiVersion: "v1", // default
      endpoint: process.env.VAULT_URL || "http://localhost:8200", // default
      token: givenToken
    };
    vaultClient = vault(options);
    return;
  }

  // otherwise try and load the token from kubernetes
  // load from the file /var/run/secrets/kubernetes.io/token
  givenToken =
    "eyJhbGciOiJSUzI1NiIsImtpZCI6IiJ9.eyJpc3MiOiJrdWJlcm5ldGVzL3NlcnZpY2VhY2NvdW50Iiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9uYW1lc3BhY2UiOiJhcmdvLXFhIiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9zZWNyZXQubmFtZSI6ImRlZmF1bHQtdG9rZW4tdm5zODgiLCJrdWJlcm5ldGVzLmlvL3NlcnZpY2VhY2NvdW50L3NlcnZpY2UtYWNjb3VudC5uYW1lIjoiZGVmYXVsdCIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VydmljZS1hY2NvdW50LnVpZCI6ImYyYjhmYTVhLTczMjgtMTFlOS05ZWY1LWZhMTYzZTE4NzExYSIsInN1YiI6InN5c3RlbTpzZXJ2aWNlYWNjb3VudDphcmdvLXFhOmRlZmF1bHQifQ.0UOxSTWNUb5OeT9AhVepURmmtLAWDrhaXjYmqCSdOHVj_MSGGotYqZPamQ1ktriqnYvP1vFyzcGWWp2U8KU-yNoF9RIGqRb5TRM3d_lSxR0Q8LeEj-by45BetUX7cmGiuOwTne3UHir9k6_C7Sjbjs8IRlWH1nDJuteZaXcYUIODITx3-7gCPwOcbOXOdR1llLDZynJKkKA1A4XHHR2l4Y-I23WuAQG3GGBRghfD01n3xUrUXtPz";

  // exchange for a vault token
  const options: vault.VaultOptions = {
    apiVersion: "v1", // default
    endpoint: process.env.VAULT_URL // default
  };

  vaultClient = vault(options);
  const response = await vaultClient.kubernetesLogin({
    role: process.env.VAULT_ROLE,
    jwt: givenToken
  });
  const clientToken = response.auth.client_token;
  console.log("login successful");
}

export async function loadSecret(key: string) {
  if (!vaultClient) {
    await login();
  }

  const result = await vaultClient.read(key);
  console.log(`loaded Secret ${key}`);
  return result.data.data;
}
