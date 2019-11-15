import dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'PRODUCTION') {
  console.debug('dotenv: ', dotenv.config());
}
export let config: ConfigManager;
export const JWT_TOKEN_PUBLIC_KEY = 'JWT_TOKEN_PUBLIC_KEY';
export const initConfigs = (configs: AppConfig) => {
  config = new ConfigManager(configs);
  return configs;
};

export interface AppConfig {
  mongoUrl(): string;
  mongoUser(): string;
  mongoPassword(): string;
  schemaName(): string;
  initialSchemaVersion(): string;
  authDisabled(): boolean;
  jwtPubKeyUrl(): string;
  jwtPubKey(): string;
  schemaServiceUrl(): string;
}

class ConfigManager {
  constructor(private impl: AppConfig) {}
  getConfig(): AppConfig {
    return this.impl;
  }
}
