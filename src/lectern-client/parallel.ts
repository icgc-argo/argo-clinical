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

import { DataRecord, SchemasDictionary, SchemaProcessingResult } from './schema-entities';
import { StaticPool } from 'node-worker-threads-pool';
import * as os from 'os';
import { loggerFor } from '../logger';
const L = loggerFor(__filename);

// check allowed cpus or use available
const cpuCount = os.cpus().length;
L.info(`available cpus: ${cpuCount}`);
const availableCpus = Number(process.env.ALLOWED_CPUS) || cpuCount;
L.info(`using ${availableCpus} cpus`);

const pool = new StaticPool({
  size: availableCpus,
  task: __dirname + '/schema-worker.js',
});

export const processRecord = async (
  dictionary: SchemasDictionary,
  schemaName: string,
  record: Readonly<DataRecord>,
  index: number,
): Promise<SchemaProcessingResult> => {
  return await pool.exec({
    dictionary,
    schemaName,
    record,
    index,
  });
};
