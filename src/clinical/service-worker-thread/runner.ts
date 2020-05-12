import { StaticPool } from 'node-worker-threads-pool';
import { WorkerTasks } from './tasks';
import * as os from 'os';
import { loggerFor } from '../../logger';
const L = loggerFor(__filename);

// check allowed cpus or use available
const cpuCount = os.cpus().length;
L.info(`available cpus: ${cpuCount}`);
const availableCpus = Number(process.env.ALLOWED_CPUS) || cpuCount;
L.info(`using ${availableCpus} cpus`);

const poolTimeOutMs = 20 * 1000;
const jsWorkerLocation = __dirname + '/worker.js';

const pool = new StaticPool({
  size: availableCpus,
  task: jsWorkerLocation,
});

export async function runTaskInWorkerThread(taskToRun: WorkerTasks, taskArgs: any) {
  const poolExecArgs = { taskToRun, taskArgs };
  const result = await pool.exec(poolExecArgs, poolTimeOutMs);
  return result;
}
