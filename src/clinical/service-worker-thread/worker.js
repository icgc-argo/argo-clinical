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

const workerThreads = require('worker_threads');
const parentPort = workerThreads.parentPort;
const tsNode = require('ts-node');

if (!process[tsNode.REGISTER_INSTANCE]) {
  tsNode.register();
}

const { WorkerTasksMap } = require('./tasks');

function run({ taskToRun, taskArgs }) {
  console.log('in worker run');

  try {
    const task = WorkerTasksMap[taskToRun];
    if (!task) {
      throw new Error(`Task ${taskToRun} is not defined`);
    }
    const result = task(...taskArgs);
    return result;
  } catch (e) {
    console.error(`Clinical worker - task ${taskToRun} error`, e);
  }
  return [];
}

parentPort.on('message', args => {
  const result = run(args);
  parentPort.postMessage(result);
});
