class ConfigManager {
    private impl: AppConfig;

    getConfig(): AppConfig {
        return this.impl;
    }

    setConfigImpl(impl: AppConfig) {
        if (this.impl != undefined) {
            throw new Error("config is already set");
        }
        this.impl = impl;
    }
}

export interface AppConfig {
    getMongoUrl(): string;
}

export const defaultAppConfigImpl: AppConfig = {
    getMongoUrl(): string {
        return process.env.CLINICAL_DB_URL;
    }
};

export const configManager: ConfigManager = new ConfigManager();