import { StaticPool } from 'node-worker-threads-pool';
import { WorkerTasks } from './tasks';

const poolSize = 1;
const poolTimeOutMs = 20 * 1000;
const jsWorkerLocation = __dirname + '/worker.js';

const pool = new StaticPool({
  size: poolSize,
  task: jsWorkerLocation,
});

export async function runTaskInWorkerThread(taskToRun: WorkerTasks, taskArgs: any) {
  const poolExecArgs = { taskToRun, taskArgs };
  const result = await pool.exec(poolExecArgs, poolTimeOutMs);
  return result;
}
