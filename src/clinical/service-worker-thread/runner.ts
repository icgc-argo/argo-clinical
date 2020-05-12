import { StaticPool } from 'node-worker-threads-pool';
import { WorkerTasks } from './tasks';

const pool = new StaticPool({
  size: 1,
  task: __dirname + '/worker.js',
});
const poolTimeOutMs = 20 * 1000;

export async function runTaskInWorkerThread(taskToRun: WorkerTasks, taskArgs: any) {
  const args = { taskToRun, taskArgs };
  const result = await pool.exec(args, poolTimeOutMs);
  return result;
}
