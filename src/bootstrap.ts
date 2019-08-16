import mongoose from "mongoose";
import { loggerFor } from "./logger";
import { AppConfig, initConfigs, JWT_TOKEN_PUBLIC_KEY } from "./config";
import * as manager from "./lectern-client/schema-manager";
import * as utils from "./utils";
import fetch from "node-fetch";
const L = loggerFor(__filename);

const setupDBConnection = (mongoUrl: string) => {
  mongoose.connection.on("connected", () => {
    L.debug("Connection Established");
  });
  mongoose.connection.on("reconnected", () => {
    L.debug("Connection Reestablished");
  });
  mongoose.connection.on("disconnected", () => {
    L.debug("Connection Disconnected");
  });
  mongoose.connection.on("close", () => {
    L.debug("Connection Closed");
  });
  mongoose.connection.on("error", error => {
    L.debug("ERROR: " + error);
  });
  const connectToDb = async (delayMillis: number) => {
    setTimeout(async () => {
      L.debug("connecting to mongo");
      try {
        // https://mongoosejs.com/docs/connections.html
        await mongoose.connect(mongoUrl, {
          autoReconnect: true,
          // http://mongodb.github.io/node-mongodb-native/3.1/reference/faq/
          socketTimeoutMS: 10000,
          connectTimeoutMS: 30000,
          keepAlive: true,
          reconnectTries: 1000,
          reconnectInterval: 3000,
          bufferMaxEntries: 0,
          // https://mongoosejs.com/docs/deprecations.html
          useNewUrlParser: true,
          useFindAndModify: false
        });
      } catch (err) {
        L.error("failed to connect to mongo", err);
        // retry in 5 secs
        connectToDb(8000);
      }
    }, delayMillis);
  };
  // initialize connection attempts
  connectToDb(1);
};

const setJwtPublicKey = async (keyUrl: string) => {
  const getKey = async (delayMillis: number) => {
    setTimeout(async () => {
      try {
        const response = await fetch(keyUrl);
        const key = await response.text();
        // make sure there is a new line before & after the begin/end marks
        const correctFormatKey = `-----BEGIN PUBLIC KEY-----\n${key
          .replace("-----BEGIN PUBLIC KEY-----", "")
          .replace("-----END PUBLIC KEY-----", "")
          .trim()}\n-----END PUBLIC KEY-----`;
        process.env[JWT_TOKEN_PUBLIC_KEY] = correctFormatKey;
      } catch (err) {
        L.error("couldn't fetch token public key", err);
        // retry in 5 secs
        getKey(5000);
      }
    }, delayMillis);
  };
  // initialize connection attempts
  getKey(1);
};

export const run = async (config: AppConfig) => {
  initConfigs(config);
  setupDBConnection(config.mongoUrl());
  if (process.env.LOG_LEVEL === "debug") {
    mongoose.set("debug", true);
  }
  await manager.loadSchema(config.schemaName(), config.initialSchemaVersion());
  // close app connections on termination
  const gracefulExit = () => {
    mongoose.connection.close(function() {
      L.debug("Mongoose default connection is disconnected through app termination");
      process.exit(0);
    });
  };

  // if the key is set as env var use it, otherwise try the url.
  if (utils.isEmptyString(config.jwtPubKey())) {
    if (utils.isEmptyString(config.jwtPubKeyUrl())) {
      throw new Error("App is not configured correctly either provide jwt pub key url or key");
    }
    setJwtPublicKey(config.jwtPubKeyUrl());
  }

  // If the Node process ends, close the Mongoose connection
  process.on("SIGINT", gracefulExit).on("SIGTERM", gracefulExit);
};
