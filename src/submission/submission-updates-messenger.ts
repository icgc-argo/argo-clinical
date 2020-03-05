import { Kafka, Producer } from 'kafkajs';
import { loggerFor } from '../logger';
const L = loggerFor(__filename);

let instance: SubmissionUpdatesMessenger;

interface SubmissionUpdatesMessenger {
  sendProgramUpdatedMessage(programId: string): Promise<void>;
  closeOpenConnections(): Promise<void>;
}

class DummyMessenger implements SubmissionUpdatesMessenger {
  sendProgramUpdatedMessage = async (programId: string) => {
    L.info('DummyMessenger called to send message to broker for updated program: ' + programId);
    return;
  };
  closeOpenConnections = async () => {
    return;
  };
}

class KafkaMessenger implements SubmissionUpdatesMessenger {
  private producer: Producer;
  private knownTopics: ExpectedTopicsMap;

  constructor(clientId: string, brokers: string[], topics: ExpectedTopicsMap) {
    this.producer = new Kafka({ clientId, brokers }).producer();
    this.knownTopics = topics;
  }

  sendProgramUpdatedMessage = async (programId: string) => {
    L.info('KafkaMessenger called to send message to broker for updated program: ' + programId);
    await this.producer.connect().catch(this.producerErrorHandler);
    await this.producer
      .send({
        topic: this.knownTopics.programUpdate,
        messages: [
          {
            key: programId,
            value: JSON.stringify({ programId }),
          },
        ],
      })
      .catch(this.producerErrorHandler);
    await this.producer.disconnect().catch(this.producerErrorHandler);
  };

  closeOpenConnections = async () => {
    await this.producer.disconnect().catch(this.producerErrorHandler);
  };

  private producerErrorHandler = (e: any) => L.error('Found producer error in Kafka messenger', e);
}

type ExpectedTopicsMap = {
  programUpdate: string;
};

export type KafkaConfig = {
  clientId: string;
  brokers: string[];
  expectedTopics: ExpectedTopicsMap;
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
    instance = new KafkaMessenger(config.clientId, config.brokers, config.expectedTopics);
  } else {
    L.info('SubmissionUpdatesMessenger initialized with DummyMessenger');
    instance = new DummyMessenger();
  }
};
