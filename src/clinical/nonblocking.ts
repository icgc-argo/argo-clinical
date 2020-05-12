import { StaticPool } from 'node-worker-threads-pool';
import { loggerFor } from '../logger';
import * as dictionaryManager from '../dictionary/manager';
import { donorDao } from './donor-repo';
const L = loggerFor(__filename);

const timeOut = 20 * 1000; // 20 sec timeout

// Global pool instead of defining in function, to reduce create and destroy overhead
const pool = new StaticPool({
  size: 1,
  task: __dirname + '/worker.js',
});

export const getClinicalData = async (programId: string): Promise<any> => {
  if (!programId) throw new Error('Missing programId!');
  const start = new Date().getTime() / 1000;

  // worker-threads can't get dictionary instance so deal with it here and pass it to pool
  const schemasWithFields = dictionaryManager.instance().getSchemasWithFields();

  // async/await functions just hang in the pool threads, root cause is unknown
  const donors = await donorDao.findByProgramIdOmitMongoDocId(programId);

  const args = { donors, schemasWithFields };
  const data = await pool.exec(args, timeOut);

  const end = new Date().getTime() / 1000;
  L.debug(`getClinicalData took ${end - start}s`);

  return data;
};
