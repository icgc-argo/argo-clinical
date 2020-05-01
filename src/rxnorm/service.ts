import * as mysql from 'mysql';
import { RxNormService, RxNormConcept } from './api';
import { promisify } from 'bluebird';
import { getPool } from './pool';

// we take the first one orderd alphabetically
const rxcuiQuery = 'select RXCUI, STR from RXNCONSO where RXCUI = ? order by STR asc';

class MysqlRxNormService implements RxNormService {
  async lookupByRxcui(rxcui: string): Promise<RxNormConcept[]> {
    const pool = getPool();
    const query = promisify(pool.query).bind(pool);
    const formattedQuery = mysql.format(rxcuiQuery, [rxcui]);
    const rs = (await query(formattedQuery)) as any[];
    if (rs.length == 0) return new Array<RxNormConcept>();
    return rs.map(r => ({
      rxcui: r['RXCUI'],
      str: r['STR'] as string,
    }));
  }
}

export default new MysqlRxNormService();
