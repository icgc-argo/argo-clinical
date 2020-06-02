/*
 * Copyright (c)  2020 The Ontario Institute for Cancer Research. All rights reserved
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
