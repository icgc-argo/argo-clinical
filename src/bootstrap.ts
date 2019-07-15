import mongoose from "mongoose";
import { loggerFor } from "./logger";
import { AppConfig, initConfigs } from "./config";
import * as schemaSvc from "./lectern-client/schema-service";
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
    mongoose.connection.on("error", (error) => {
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
                connectToDb(5000);
            }
        }, delayMillis);
    };
    // initialize connection attempts
    connectToDb(1);
};

export const run = async (config: AppConfig) => {
    initConfigs(config);
    setupDBConnection(config.mongoUrl());
    await schemaSvc.loadSchema(config.schemaName(), config.initialSchemaVersion());
    // close app connections on termination
    const gracefulExit = () => {
        mongoose.connection.close(function () {
            L.debug("Mongoose default connection is disconnected through app termination");
            process.exit(0);
        });
    };

    // If the Node process ends, close the Mongoose connection
    process.on("SIGINT", gracefulExit).on("SIGTERM", gracefulExit);
};