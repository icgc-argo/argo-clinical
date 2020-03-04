import { Kafka, Producer } from 'kafkajs';

let instance: MessageManager;

interface MessageManager {
  sendProgramUpdateMessage(programId: string): Promise<void>;
  closeOpenConnections(): Promise<void>;
}

class DummyMessageManager implements MessageManager {
  sendProgramUpdateMessage = async (programId: string) => {
    return;
  };

  closeOpenConnections = async () => {
    return;
  };
}

class KafkaMessageManager implements MessageManager {
  private producer: Producer;
  private knownTopics: ExpectedTopicsMap;

  constructor(clientId: string, brokers: string[], topics: ExpectedTopicsMap) {
    this.producer = new Kafka({ clientId, brokers }).producer();
    this.knownTopics = topics;
  }

  sendProgramUpdateMessage = async (programId: string) => {
    await this.producer.connect();
    await this.producer.send({
      topic: this.knownTopics.progoramUpdate,
      messages: [
        {
          key: programId,
          value: JSON.stringify({ programId }),
        },
      ],
    });
    await this.producer.disconnect();
  };

  closeOpenConnections = async () => {
    await this.producer.disconnect();
  };
}

type ExpectedTopicsMap = {
  progoramUpdate: string;
};

export type KafkaConfig = {
  clientId: string;
  brokers: string[];
  expectedTopics: ExpectedTopicsMap;
};

export const getInstace = (): MessageManager => {
  if (!instance) {
    throw new Error('Message manager was not intitialized');
  }
  return instance;
};

export const initialize = (kafkaMessagingEnabled: boolean, config: KafkaConfig) => {
  if (kafkaMessagingEnabled) {
    instance = new KafkaMessageManager(config.clientId, config.brokers, config.expectedTopics);
  } else {
    instance = new DummyMessageManager();
  }
};
