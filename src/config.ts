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
  kafkaProperties(): KafkaConfigurations;
  rxNormDbProperties(): RxNormDbConfig;
}

class ConfigManager {
  constructor(private impl: AppConfig) {}
  getConfig(): AppConfig {
    return this.impl;
  }
}

export interface KafkaConfigurations {
  kafkaMessagingEnabled(): boolean;
  kafkaClientId(): string;
  kafkaBrokers(): string[];
  kafkaTopicProgramUpdate(): string;
  kafkaTopicProgramUpdateConfigPartitions(): number;
  kafkaTopicProgramUpdateConfigReplications(): number;
}
export interface RxNormDbConfig {
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
  timeout: number;
}
