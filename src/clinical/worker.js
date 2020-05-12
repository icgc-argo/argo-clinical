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

const service = require('./clinical-service');

function extractDataFromDonorsProxy(args) {
  console.log('in extractDataFromDonorsProxy');
  try {
    const data = service.extractDataFromDonors(args.donors, args.schemasWithFields);
    return data;
  } catch (e) {
    console.error('Clinical worker error', e);
  }
  return [];
}

parentPort.on('message', args => {
  const result = extractDataFromDonorsProxy(args);
  parentPort.postMessage(result);
});
