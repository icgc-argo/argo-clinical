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

import { loggerFor } from '../../logger';
import mongoose from 'mongoose';

const L = loggerFor(__filename);

export interface PersistedConfigurationRepository {
  createOrUpdate(configuration: any): Promise<Configuration>;
  getPersistedConfig(): Promise<Configuration | null>;
  setSubmissionDisabled(disabled: boolean): Promise<boolean>;
  getSubmissionDisabled(): Promise<boolean>;
}

export const configRepository: PersistedConfigurationRepository = {
  async createOrUpdate(configuration: any) {
    return await PersistedConfigurationModel.findOneAndUpdate(
      {},
      { ...configuration },
      { upsert: true, new: true },
    ).exec();
  },
  async getPersistedConfig() {
    return await PersistedConfigurationModel.findOne({}).exec();
  },
  async setSubmissionDisabled(disabled: boolean) {
    const updatedConfig = await PersistedConfigurationModel.findOneAndUpdate(
      {},
      { submissionDisabled: disabled },
      { new: true },
    ).exec();
    if (!updatedConfig) {
      throw new Error('Missing persisted configurations!');
    }
    return updatedConfig.submissionDisabled;
  },
  async getSubmissionDisabled() {
    const configuration = await PersistedConfigurationModel.findOne({}).exec();
    if (!configuration) {
      throw new Error('Missing persisted configurations!');
    }
    return configuration.submissionDisabled;
  },
};

interface Configuration {
  submissionDisabled: boolean;
}

type ConfigurationDocument = mongoose.Document & Configuration;

const PersistedConfigurationSchema = new mongoose.Schema(
  {
    submissionDisabled: { type: Boolean, default: false },
  },
  { timestamps: true, minimize: false },
);

export const PersistedConfigurationModel = mongoose.model<ConfigurationDocument>(
  'PersistedConfiguration',
  PersistedConfigurationSchema,
);
