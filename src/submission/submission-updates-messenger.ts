/*
 * Copyright (c) 2023 The Ontario Institute for Cancer Research. All rights reserved
 *
 * This program and the accompanying materials are made available under the terms of
 * the GNU Affero General Public License v3.0. You should have received a copy of the
 * GNU Affero General Public License along with this program.
 *  If not, see <http://www.gnu.org/licenses/>.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
 * SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
 * IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { Kafka } from 'kafkajs';
import { loggerFor } from '../logger';
const L = loggerFor(__filename);

let instance: SubmissionUpdatesMessenger;

export type ClinicalProgramUpdateMessage = {
	programId: string;
	donorIds?: string[];
};

export interface SubmissionUpdatesMessenger {
	sendProgramUpdatedMessage({ programId, donorIds }: ClinicalProgramUpdateMessage): Promise<void>;
	closeOpenConnections(): Promise<void>;
}

class DummyMessenger implements SubmissionUpdatesMessenger {
	sendProgramUpdatedMessage = async ({ programId, donorIds }: ClinicalProgramUpdateMessage) => {
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

	const sendProgramUpdatedMessage = async ({
		programId,
		donorIds,
	}: ClinicalProgramUpdateMessage) => {
		L.info('KafkaMessenger called to send message to broker for updated program: ' + programId);
		const producer = kafka.producer();
		await producer.connect().catch(errorHandler);
		await producer
			.send({
				topic: programUpdateTopic.topic,
				messages: [
					{
						key: programId,
						value: JSON.stringify({ programId, donorIds }),
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
