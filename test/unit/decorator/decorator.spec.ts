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

import chai from 'chai';
import { initConfigs } from '../../../src/config';
import { ProtectTestEndpoint } from '../../../src/decorators/index';

describe('decorator', () => {
	before(() => {
		initConfigs({
			mongoPassword() {
				return '';
			},
			mongoUser() {
				return '';
			},
			mongoUrl: () => {
				return '';
			},
			initialSchemaVersion() {
				return '';
			},
			schemaName() {
				return 'schemaName';
			},
			jwtPubKey() {
				return 'TEST_PUB_KEY';
			},
			jwtPubKeyUrl() {
				return '';
			},
			schemaServiceUrl() {
				return `file://${__dirname}/stub-schema.json`;
			},
			testApisDisabled() {
				return true;
			},
			kafkaProperties() {
				return {
					kafkaMessagingEnabled() {
						return false;
					},
					kafkaBrokers() {
						return new Array<string>();
					},
					kafkaClientId() {
						return '';
					},
					kafkaTopicProgramUpdate() {
						return '';
					},
					kafkaTopicProgramUpdateConfigPartitions(): number {
						return NaN;
					},
					kafkaTopicProgramUpdateConfigReplications(): number {
						return NaN;
					},
				};
			},
			rxNormDbProperties() {
				return {
					database: '',
					host: '',
					password: '',
					port: 0,
					connectTimeout: 0,
					user: '',
				};
			},
			egoUrl() {
				return '';
			},
			egoClientId() {
				return '';
			},
			egoClientSecret() {
				return '';
			},
		});
	});

	class MockResponse {
		_status: number = 0;

		status(s: number): MockResponse {
			this._status = s;
			return this;
		}

		send(body: string): MockResponse {
			console.log('sent');
			return this;
		}
	}

	class TestClass {
		@ProtectTestEndpoint()
		public callapi(req: object, response: MockResponse): string {
			return 'response';
		}
	}

	it('ProtectTestEndpoint() should be called', function() {
		const testClass = new TestClass();
		const r = new MockResponse();
		testClass.callapi({}, r);
		chai.expect(r._status).to.eq(405);
	});
});
