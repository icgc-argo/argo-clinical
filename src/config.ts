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
  jwtPubKeyUrl(): string;
  jwtPubKey(): string;
  schemaServiceUrl(): string;
  testApisDisabled(): boolean;
  kafkaMessagingEnabled(): boolean;
  kafkaClientId(): string;
  kafkaBrokers(): string[];
  kafkaTopicProgramUpdate(): string;
  kafkaTopicProgramUpdateConfigPartitions(): number;
  kafkaTopicProgramUpdateConfigReplications(): number;
}

class ConfigManager {
  constructor(private impl: AppConfig) {}
  getConfig(): AppConfig {
    return this.impl;
  }
}
