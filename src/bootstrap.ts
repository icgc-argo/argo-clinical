import mongoose from "mongoose";
import { loggerFor } from "./logger";
const L = loggerFor(__filename);

namespace Configs {
    export let config: Configs.ConfigManager;

    export class ConfigManager {
        constructor(private impl: AppConfig) {}
        getConfig(): AppConfig {
            return this.impl;
        }
    }

    export const initConfigs = (configs: AppConfig) => {
        if (configs == undefined) {
            configs = defaultAppConfigImpl;
        }
        config = new ConfigManager(configs);
        return configs;
    };

    export interface AppConfig {
        getMongoUrl(): string;
    }
}

const defaultAppConfigImpl: Configs.AppConfig = {
    getMongoUrl(): string {
        return process.env.CLINICAL_DB_URL;
    }
};

const setupDBConnection = () => {
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
                await mongoose.connect(Configs.config.getConfig().getMongoUrl(), {
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
export const run = (configs?: Configs.AppConfig | undefined) => {
    configs = Configs.initConfigs(configs);
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