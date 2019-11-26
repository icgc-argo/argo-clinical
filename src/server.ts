// Has to import config before any other import uses the configurations
import { AppConfig } from './config';
import * as bootstrap from './bootstrap';
import app from './app';
import * as vault from './vault-k8s';
import { Server } from 'http';
import * as persistedConfig from './submission/persisted-config/service';

let secrets: any = {};
let server: Server;

(async () => {
  if (process.env.VAULT_ENABLED && process.env.VAULT_ENABLED == 'true') {
    if (!process.env.VAULT_SECRETS_PATH) {
      throw new Error('Path to secrets not specified but vault is enabled');
    }

    try {
      const secretsData = await vault.loadSecret(process.env.VAULT_SECRETS_PATH);
      secrets = JSON.parse(secretsData.content);
    } catch (err) {
      console.error(err);
      throw new Error('failed to load secrets from vault.');
    }

    console.log(`secret keys found ====> ${Object.keys(secrets)}`);
  }

  const defaultAppConfigImpl: AppConfig = {
    mongoUser(): string {
      return process.env.CLINICAL_DB_USERNAME || secrets.CLINICAL_DB_USERNAME;
    },
    mongoPassword(): string {
      return process.env.CLINICAL_DB_PASSWORD || secrets.CLINICAL_DB_PASSWORD;
    },
    mongoUrl(): string {
      return process.env.CLINICAL_DB_URL || '';
    },
    initialSchemaVersion(): string {
      return process.env.INITIAL_SCHEMA_VERSION || '';
    },
    schemaName(): string {
      return process.env.SCHEMA_NAME || '';
    },
    jwtPubKeyUrl(): string {
      return process.env.JWT_TOKEN_PUBLIC_KEY_URL || '';
    },
    jwtPubKey(): string {
      return process.env.JWT_TOKEN_PUBLIC_KEY || '';
    },
    schemaServiceUrl(): string {
      return process.env.LECTERN_URL || '';
    },
  };

  await bootstrap.run(defaultAppConfigImpl);

  await persistedConfig.operations.setDefaultPersistedConfig();

  /**
   * Start Express server.
   */
  server = app.listen(app.get('port'), () => {
    console.log(
      ' App is running at http://localhost:%d in %s mode',
      app.get('port'),
      app.get('env'),
    );
    console.log('  Press CTRL-C to stop\n');
  });
})();

// export default server;
