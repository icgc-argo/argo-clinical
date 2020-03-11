import { Kafka, Producer, ITopicConfig } from 'kafkajs';
import { loggerFor } from '../logger';
const L = loggerFor(__filename);

let instance: SubmissionUpdatesMessenger;

export interface SubmissionUpdatesMessenger {
  sendProgramUpdatedMessage(programId: string): Promise<void>;
  closeOpenConnections(): Promise<void>;
}

class DummyMessenger implements SubmissionUpdatesMessenger {
  sendProgramUpdatedMessage = async (programId: string) => {
    L.info('DummyMessenger called to send message to broker for updated program: ' + programId);
    return;
  };
  closeOpenConnections = async () => {
    L.info('Close Dummy connection');
    return;
  };
}

class KafkaMessenger implements SubmissionUpdatesMessenger {
  private kafka: Kafka;
  private programUpdateTopic: TopicConfig;

  constructor(clientId: string, brokers: string[], topics: TopicConfig) {
    this.kafka = new Kafka({ clientId, brokers });
    this.programUpdateTopic = topics;
  }

  sendProgramUpdatedMessage = async (programId: string) => {
    L.info('KafkaMessenger called to send message to broker for updated program: ' + programId);

    await this.createMissingProgramUpdateTopic().catch(this.errorHandler);

    const producer = this.kafka.producer();
    await producer.connect().catch(this.errorHandler);
    await producer
      .send({
        topic: this.programUpdateTopic.topic,
        messages: [
          {
            key: programId,
            value: JSON.stringify({ programId }),
          },
        ],
      })
      .catch(this.errorHandler);
    await producer.disconnect().catch(this.errorHandler);
  };

  closeOpenConnections = async () => {
    L.info('Closing any open Kafka connections');
    await this.kafka.admin().disconnect();
    await this.kafka.producer().disconnect();
  };

  private createMissingProgramUpdateTopic = async () => {
    const admin = this.kafka.admin();
    await admin.connect();
    await admin.createTopics({
      topics: [this.programUpdateTopic],
    });
    await admin.disconnect();
  };

  private errorHandler = (e: any) => L.error('Found error in Kafka messenger: ', e);
}

type TopicConfig = {
  topic: string;
  numPartitions: number;
  replicationFactor: number;
};

export type KafkaConfig = {
  clientId: string;
  brokers: string[];
  programUpdateTopic: TopicConfig;
};

export const getInstace = (): SubmissionUpdatesMessenger => {
  if (!instance) {
    throw new Error('Messenger was not intitialized');
  }
  return instance;
};

export const initialize = (kafkaMessagingEnabled: boolean, config: KafkaConfig) => {
  if (kafkaMessagingEnabled) {
    L.info('SubmissionUpdatesMessenger initialized with KafkaMessenger');
    instance = new KafkaMessenger(config.clientId, config.brokers, config.programUpdateTopic);
  } else {
    L.info('SubmissionUpdatesMessenger initialized with DummyMessenger');
    instance = new DummyMessenger();
  }
};
