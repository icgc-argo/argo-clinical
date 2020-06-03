/*
 * Copyright (c) 2020 The Ontario Institute for Cancer Research. All rights reserved
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
// ts node is required to import ts modules like "schema-functions.ts" in this case since
// worker threads run in their own V8 instance
const tsNode = require('ts-node');

/**
 * when we run the app with node directly like this:
 * node -r ts-node/register server.ts
 * we will have a registered ts node instance, registering another one will result in wierd behaviour
 * however when we run with mocha:
 * mocha -r ts-node/register <path to test file>.ts
 * (same applies if we run with ts node directly: ts-node server.ts)
 * the worker thread won't have an instance of ts node transpiler
 * unlike node for some reason which seem to attach the isntance to the worker thread process.
 *
 * so we had to add this work around to avoid double registry in different run modes.
 * root cause of why mocha acts different than node is not found yet.
 */
if (!process[tsNode.REGISTER_INSTANCE]) {
  tsNode.register();
}
const service = require('./schema-functions');

function processProxy(args) {
  return service.process(args.dictionary, args.schemaName, args.record, args.index);
}

parentPort.on('message', args => {
  const result = processProxy(args);
  parentPort.postMessage(result);
});
