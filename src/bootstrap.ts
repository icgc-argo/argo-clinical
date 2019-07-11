import mongoose from "mongoose";
import { loggerFor } from "./logger";
import { config, AppConfig, initConfigs } from "./config";

const L = loggerFor(__filename);
const setupDBConnection = () => {
    const MONGO_URL = config.getConfig().getMongoUrl();
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
                await mongoose.connect(MONGO_URL, {
                    autoReconnect: true,
                    socketTimeoutMS: 0,
                    keepAlive: true,
                    reconnectTries: 1000,
                    reconnectInterval: 3000,
                    useNewUrlParser: true
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

export const run = (config: AppConfig) => {
    initConfigs(config);
    setupDBConnection();
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