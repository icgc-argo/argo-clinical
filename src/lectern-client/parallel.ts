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
