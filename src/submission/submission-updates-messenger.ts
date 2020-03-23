import { Kafka } from 'kafkajs';
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

const createKafkaMessenger = async (
  clientId: string,
  brokers: string[],
  programUpdateTopic: TopicConfig,
): Promise<SubmissionUpdatesMessenger> => {
  const kafka: Kafka = new Kafka({ clientId, brokers });

  // create topic if not exists
  const admin = kafka.admin();
  await admin.connect();
  await admin.createTopics({
    topics: [programUpdateTopic],
  });
  await admin.disconnect();

  const sendProgramUpdatedMessage = async (programId: string) => {
    L.info('KafkaMessenger called to send message to broker for updated program: ' + programId);
    const producer = kafka.producer();
    await producer.connect().catch(errorHandler);
    await producer
      .send({
        topic: programUpdateTopic.topic,
        messages: [
          {
            key: programId,
            value: JSON.stringify({ programId }),
          },
        ],
      })
      .catch(errorHandler);
    await producer.disconnect().catch(errorHandler);
  };

  const closeOpenConnections = async () => {
    L.info('Closing any open Kafka connections');
    await kafka.admin().disconnect();
    await kafka.producer().disconnect();
  };

  const errorHandler = (e: any) => L.error('Found error in Kafka messenger: ', e);
  return {
    sendProgramUpdatedMessage,
    closeOpenConnections,
  };
};

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

export const getInstance = (): SubmissionUpdatesMessenger => {
  if (!instance) {
    throw new Error('Messenger was not intitialized');
  }
  return instance;
};

export const initialize = async (kafkaMessagingEnabled: boolean, config: KafkaConfig) => {
  if (kafkaMessagingEnabled) {
    L.info('SubmissionUpdatesMessenger initialized with KafkaMessenger');
    instance = await createKafkaMessenger(
      config.clientId,
      config.brokers,
      config.programUpdateTopic,
    );
  } else {
    L.info('SubmissionUpdatesMessenger initialized with DummyMessenger');
    instance = new DummyMessenger();
  }
};
