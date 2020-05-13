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
