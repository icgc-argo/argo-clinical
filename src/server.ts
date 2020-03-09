// Has to import config before any other import uses the configurations
import { AppConfig } from './config';
import * as vault from './vault-k8s';
import { Server } from 'http';
// we import here to allow configs to fully load
import * as bootstrap from './bootstrap';
import app from './app';
import { database, up } from 'migrate-mongo';

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

  /**
   * Migrate mongo config requires exact undefined to be able to connect to db without user/password (dev/qa) env
   * if the value is undefined or empty string we have to avoid setting it in the env because process.env will force string "undefined"
   */
  const dbUserName: string = process.env.CLINICAL_DB_USERNAME || secrets.CLINICAL_DB_USERNAME || '';
  if (dbUserName !== '') {
    process.env.CLINICAL_DB_USERNAME = dbUserName;
  }
  const dbPassword: string = process.env.CLINICAL_DB_PASSWORD || secrets.CLINICAL_DB_PASSWORD || '';
  if (dbPassword !== '') {
    process.env.CLINICAL_DB_PASSWORD = dbPassword;
  }

  const defaultAppConfigImpl: AppConfig = {
    mongoUser(): string {
      return dbUserName;
    },
    mongoPassword(): string {
      return dbPassword;
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
    testApisDisabled(): boolean {
      return process.env.DISABLE_TEST_APIS === 'false' ? false : true;
    },
    kafkaMessagingEnabled(): boolean {
      return process.env.KAFKA_MESSAGING_ENABLED === 'true' ? true : false;
    },
    kafkaClientId(): string {
      return process.env.KAFKA_CLIENT_ID || '';
    },
    kafkaBrokers(): string[] {
      return process.env.KAFKA_BROKERS?.split(',') || new Array<string>();
    },
    kafkaTopicProgramUpdate(): string {
      return process.env.KAFKA_TOPIC_PROGRAM_UPDATE || '';
    },
  };

  let connection: any;
  try {
    connection = await database.connect();
    const migrated = await up(connection.db);
    migrated.forEach((fileName: string) => console.log('Migrated:', fileName));
  } catch (err) {
    console.log('failed to start migration', err);
    process.exit(-10);
  }
  await bootstrap.run(defaultAppConfigImpl);
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
