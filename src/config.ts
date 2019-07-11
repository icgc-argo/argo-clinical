import dotenv from "dotenv";
if (process.env.NODE_ENV !== "PRODUCTION") {
    console.debug("dotenv: ", dotenv.config());
}
export let config: ConfigManager;

export const initConfigs = (configs: AppConfig) => {
    config = new ConfigManager(configs);
    return configs;
};

export interface AppConfig {
    getMongoUrl(): string;
}

class ConfigManager {
    constructor(private impl: AppConfig) {}
    getConfig(): AppConfig {
        return this.impl;
    }
}


