import mongoose from 'mongoose';
import { loggerFor } from './logger';
import { AppConfig, initConfigs, JWT_TOKEN_PUBLIC_KEY, RxNormDbConfig } from './config';
import * as dictionaryManager from './dictionary/manager';
import * as utils from './utils';
import fetch from 'node-fetch';
import { setStatus, Status } from './app-health';
import * as persistedConfig from './submission/persisted-config/service';
import * as submissionUpdatesMessenger from './submission/submission-updates-messenger';
import { initPool } from './rxnorm/pool';
import { promisify } from 'bluebird';
import { cat } from 'shelljs';
import { Pool } from 'mysql';

const L = loggerFor(__filename);

const setupDBConnection = async (mongoUrl: string, userName: string, password: string) => {
  mongoose.connection.on('connected', () => {
    L.debug('Connection Established');
    setStatus('db', { status: Status.OK });
  });
  mongoose.connection.on('reconnected', () => {
    L.debug('Connection Reestablished');
    setStatus('db', { status: Status.OK });
  });
  mongoose.connection.on('disconnected', () => {
    L.debug('Connection Disconnected');
    setStatus('db', { status: Status.ERROR });
  });
  mongoose.connection.on('close', () => {
    L.debug('Connection Closed');
  });
  mongoose.connection.on('error', error => {
    L.debug('ERROR: ' + error);
    setStatus('db', { status: Status.ERROR, info: { error } });
  });

  // initialize connection attempts
  await connectToDb(8000, mongoUrl, userName, password);
};

const connectToDb = async (
  delayMillis: number,
  mongoUrl: string,
  username: string,
  password: string,
) => {
  L.debug('in connectToDb');
  try {
    await connect(delayMillis, mongoUrl, username, password);
  } catch (err) {
    L.error('failed to connect', err);
  }
};

async function connect(delayMillis: number, mongoUrl: string, username: string, password: string) {
  try {
    // https://mongoosejs.com/docs/connections.html
    await mongoose.connect(mongoUrl, {
      autoReconnect: true,
      // http://mongodb.github.io/node-mongodb-native/3.1/reference/faq/
      socketTimeoutMS: 10000,
      connectTimeoutMS: 30000,
      keepAlive: true,
      reconnectTries: 10,
      reconnectInterval: 3000,
      bufferCommands: false,
      bufferMaxEntries: 0,
      user: username,
      pass: password,
      // https://mongoosejs.com/docs/deprecations.html
      useNewUrlParser: true,
      useFindAndModify: false,
    });
    L.debug('mongoose connected');
  } catch (err) {
    L.error('failed to connect to mongo', err);
    setStatus('db', { status: Status.ERROR });
    setTimeout(() => {
      L.debug('retrying to connect to mongo');
      connect(delayMillis, mongoUrl, username, password);
    }, delayMillis);
  }
}

const setJwtPublicKey = (keyUrl: string) => {
  const getKey = (delayMillis: number) => {
    setTimeout(async () => {
      try {
        const response = await fetch(keyUrl);
        const key = await response.text();
        if (response.status != 200 || key.indexOf('-----BEGIN PUBLIC KEY-----') === -1) {
          throw new Error(`failed to fetch valid JwtPublicKey, response:  ${key}`);
        }
        // make sure there is a new line before & after the begin/end marks
        const correctFormatKey = `-----BEGIN PUBLIC KEY-----\n${key
          .replace('-----BEGIN PUBLIC KEY-----', '')
          .replace('-----END PUBLIC KEY-----', '')
          .trim()}\n-----END PUBLIC KEY-----`;
        process.env[JWT_TOKEN_PUBLIC_KEY] = correctFormatKey;
        setStatus('egoPublicKey', { status: Status.OK });
      } catch (err) {
        L.error("couldn't fetch token public key", err);
        setStatus('egoPublicKey', {
          status: Status.ERROR,
          info: {
            error: err,
          },
        });
        // retry in 5 secs
        getKey(5000);
      }
    }, delayMillis);
  };
  // initialize connection attempts
  getKey(1);
};

const setupRxNormConnection = (conf: RxNormDbConfig) => {
  if (!conf.host) return;
  const pool = initPool({
    database: conf.database,
    host: conf.host,
    password: conf.password,
    user: conf.user,
    port: conf.port,
    timeout: conf.timeout,
  });
  pool.on('connection', () => setStatus('rxNormDb', { status: Status.OK }));

  // check for rxnorm connection every 5 minutes
  pingRxNorm(pool);
  setInterval(async () => {
    await pingRxNorm(pool);
  }, 5 * 60 * 1000);
};

async function pingRxNorm(pool: Pool) {
  try {
    const query = promisify(pool.query).bind(pool);
    await query('select 1');
    setStatus('rxNormDb', { status: Status.OK });
  } catch (err) {
    L.error('cannot get connection to rxnorm', err);
    setStatus('rxNormDb', { status: Status.ERROR });
  }
}

export const run = async (config: AppConfig) => {
  initConfigs(config);

  // setup mongo connection
  await setupDBConnection(config.mongoUrl(), config.mongoUser(), config.mongoPassword());
  if (process.env.LOG_LEVEL === 'debug') {
    console.log('setting mongoose to debug verbosity');
    mongoose.set('debug', true);
  }

  // RxNorm Db
  setupRxNormConnection(config.rxNormDbProperties());

  // setup messenger with kafka configs
  const kafkaProps = config.kafkaProperties();
  await submissionUpdatesMessenger.initialize(kafkaProps.kafkaMessagingEnabled(), {
    clientId: kafkaProps.kafkaClientId(),
    brokers: kafkaProps.kafkaBrokers(),
    programUpdateTopic: {
      topic: kafkaProps.kafkaTopicProgramUpdate(),
      numPartitions: kafkaProps.kafkaTopicProgramUpdateConfigPartitions(),
      replicationFactor: kafkaProps.kafkaTopicProgramUpdateConfigReplications(),
    },
  });

  // setup schema manager
  try {
    dictionaryManager.create(config.schemaServiceUrl());
    await loadSchema(config.schemaName(), config.initialSchemaVersion());
  } catch (err) {
    L.error('failed to load schema', err);
  }

  // close app connections on termination
  const gracefulExit = async () => {
    await submissionUpdatesMessenger.getInstance().closeOpenConnections();

    await mongoose.connection.close(function() {
      L.debug('Mongoose default connection is disconnected through app termination');
    });

    process.exit(0);
  };

  // if the key is set as env var use it, otherwise try the url.
  if (utils.isEmptyString(config.jwtPubKey())) {
    if (utils.isEmptyString(config.jwtPubKeyUrl())) {
      throw new Error('App is not configured correctly either provide jwt pub key url or key');
    }
    setJwtPublicKey(config.jwtPubKeyUrl());
    setInterval(() => {
      setJwtPublicKey(config.jwtPubKeyUrl());
    }, 5 * 60 * 1000);
  } else {
    setStatus('egoPublicKey', { status: Status.OK });
  }

  await persistedConfig.initSubmissionConfigsIfNoneExist();

  // If the Node process ends, close active connections
  process.on('SIGINT', gracefulExit).on('SIGTERM', gracefulExit);
};

export async function loadSchema(schemaName: string, initialVersion: string) {
  try {
    await dictionaryManager.instance().loadSchemaAndSave(schemaName, initialVersion);
    setStatus('schema', { status: Status.OK });
  } catch (err) {
    L.error('failed to load the schema', err);
    setStatus('schema', { status: Status.ERROR, info: { error: err } });
    setTimeout(() => {
      L.debug('retrying to fetch schema');
      loadSchema(schemaName, initialVersion);
    }, 5000);
  }
}
