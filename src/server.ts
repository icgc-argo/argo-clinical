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
import { token } from 'morgan';

console.time('boot time');
// Has to import config before any other import uses the configurations
import { AppConfig, RxNormDbConfig, KafkaConfigurations } from './config';
import dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'PRODUCTION') {
	console.debug('dotenv: ', dotenv.config());
}
import * as vault from './vault-k8s';
import { Server } from 'http';
// we import here to allow configs to fully load
import * as bootstrap from './bootstrap';
import app from './app';
import { GlobalGqlContext } from './app';
import { database, up } from 'migrate-mongo';

import { ApolloServer, ContextFunction } from '@apollo/server';
import {
	StandaloneServerContextFunctionArgument,
	startStandaloneServer,
} from '@apollo/server/standalone';
import schema from './schemas/index';
import { EgoJwtData } from '@icgc-argo/ego-token-utils/dist/common';

let secrets: any = {};
let server: Server;

(async () => {
	if (process.env.VAULT_ENABLED && process.env.VAULT_ENABLED == 'true') {
		if (!process.env.VAULT_SECRETS_PATH) {
			throw new Error('Path to secrets not specified but vault is enabled');
		}

		try {
			secrets = await vault.loadSecret(process.env.VAULT_SECRETS_PATH);
		} catch (err) {
			console.error(err);
			throw new Error('failed to load secrets from vault.');
		}

		console.log(`secret keys found ====> ${Object.keys(secrets)}`);
	}

	/**
	 * Migrate mongo config requires exact undefined to be able to connect to db without user/password (dev/qa) env
	 * if the value is undefined or empty string we have to avoid setting it in the env because process.env will force string "undefined"
	 */
	const dbUserName: string = process.env.CLINICAL_DB_USERNAME || secrets.CLINICAL_DB_USERNAME || '';
	if (dbUserName !== '') {
		process.env.CLINICAL_DB_USERNAME = dbUserName;
	}
	const dbPassword: string = process.env.CLINICAL_DB_PASSWORD || secrets.CLINICAL_DB_PASSWORD || '';
	if (dbPassword !== '') {
		process.env.CLINICAL_DB_PASSWORD = dbPassword;
	}

	const defaultAppConfigImpl: AppConfig = {
		mongoUser(): string {
			return dbUserName;
		},
		mongoPassword(): string {
			return dbPassword;
		},
		mongoUrl(): string {
			return process.env.CLINICAL_DB_URL || '';
		},
		initialSchemaVersion(): string {
			return process.env.INITIAL_SCHEMA_VERSION || '';
		},
		schemaName(): string {
			return process.env.SCHEMA_NAME || '';
		},
		jwtPubKeyUrl(): string {
			return process.env.JWT_TOKEN_PUBLIC_KEY_URL || '';
		},
		jwtPubKey(): string {
			return process.env.JWT_TOKEN_PUBLIC_KEY || '';
		},
		schemaServiceUrl(): string {
			return process.env.LECTERN_URL || '';
		},
		testApisDisabled(): boolean {
			return process.env.DISABLE_TEST_APIS === 'false' ? false : true;
		},
		kafkaProperties(): KafkaConfigurations {
			return {
				kafkaMessagingEnabled(): boolean {
					return process.env.KAFKA_MESSAGING_ENABLED === 'true' ? true : false;
				},
				kafkaClientId(): string {
					return process.env.KAFKA_CLIENT_ID || '';
				},
				kafkaBrokers(): string[] {
					return process.env.KAFKA_BROKERS?.split(',') || new Array<string>();
				},
				kafkaTopicProgramUpdate(): string {
					return process.env.KAFKA_TOPIC_PROGRAM_UPDATE || '';
				},
				kafkaTopicProgramUpdateConfigPartitions(): number {
					return Number(process.env.KAFKA_TOPIC_PROGRAM_UPDATE_CONFIG_PARTITIONS) || 1;
				},
				kafkaTopicProgramUpdateConfigReplications(): number {
					return Number(process.env.KAFKA_TOPIC_PROGRAM_UPDATE_CONFIG_REPLICATIONS) || 1;
				},
			};
		},
		rxNormDbProperties(): RxNormDbConfig {
			return {
				database: process.env.RXNORM_DB_NAME || 'rxnorm',
				host: process.env.RXNORM_DB_HOST || 'localhost',
				password: process.env.RXNORM_DB_PASSWORD || secrets.RXNORM_DB_PASSWORD || '',
				user: process.env.RXNORM_DB_USER || secrets.RXNORM_DB_USER || 'clinical',
				port: Number(process.env.RXNORM_DB_PORT) || 3306,
				timeout: Number(process.env.RXNORM_DB_TIMEOUT_MILLIS) || 5 * 1000,
			};
		},
		egoUrl(): string {
			return process.env.EGO_URL || secrets.EGO_URL || '';
		},
		tokenUrl(): string {
			return process.env.TOKEN_URI || '';
		},
		idServiceUrl(): string {
			return process.env.ID_SERVICE_URL || '';
		},
		egoClientId(): string {
			return process.env.EGO_CLIENT_ID || secrets.EGO_CLIENT_ID || '';
		},
		egoClientSecret(): string {
			return process.env.EGO_CLIENT_SECRET || secrets.EGO_CLIENT_SECRET || '';
		},
	};

	let connection: any;
	try {
		connection = await database.connect();
		const migrated = await up(connection.db);
		migrated.forEach((fileName: string) => console.log('Migrated:', fileName));
	} catch (err) {
		console.error('failed to do migration', err);
		process.exit(-10);
		return;
	}
	await bootstrap.run(defaultAppConfigImpl);

	/**
	 * Start Graphql server.
	 */

	const context: ContextFunction<
		[StandaloneServerContextFunctionArgument],
		GlobalGqlContext
	> = async ({ req, res }) => {
		// Get the user token from the headers.
		const authHeader = req.headers.authorization;
		let userJwtData: EgoJwtData | undefined = undefined;
		try {
			if (authHeader) {
				const jwt = authHeader.replace('Bearer ', '');
			}
		} catch (err) {
			userJwtData = undefined;
		}
		// Add the user to the context
		return {
			isUserRequest: true,
			egoToken: (authHeader || '').split('Bearer ').join(''),
			Authorization: `Bearer ${(authHeader || '').replace(/^Bearer[\s]*!/, '')}` || '',
			userJwtData,
			dataLoaders: {},
		};
	};

	const apolloServer = new ApolloServer<GlobalGqlContext>({
		schema,
	});

	const { url } = await startStandaloneServer(apolloServer, {
		context,
		listen: { port: app.get('graphqlPort') },
	});

	/**
	 * Start Express server.
	 */
	server = app.listen(app.get('port'), () => {
		console.log(
			' App is running at http://localhost:%d in %s mode',
			app.get('port'),
			app.get('env'),
		);
		console.debug(`Swagger Docs available at http://localhost:${app.get('port')}/api-docs`);
		console.debug(`Graphql Server available at http://localhost:${app.get('graphqlPort')}/graphql`);
		console.log('  Press CTRL-C to stop\n');
		console.timeEnd('boot time');
	});
})();
