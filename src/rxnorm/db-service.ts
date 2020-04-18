import * as mysql from 'mysql';
import { RxNormService } from './api';
import { promisify } from 'bluebird';
const pool = mysql.createPool({
  connectTimeout: 10,
  database: 'rxnorm',
  user: 'user',
  password: 'password',
  host: 'localhost',
});

const query = promisify(pool.query).bind(pool);

const rxcuiQuery = 'select RXCUI, STR from RXNCONSO where RXCUI = ? order by STR asc';
const rxStrQuery = 'select RXCUI, STR from RXNCONSO where STR = ? order by STR asc';

class MysqlRxNormService implements RxNormService {
  async lookupByRxcui(rxcui: number) {
    const formattedQuery = mysql.format(rxcuiQuery, [rxcui]);
    const rs = (await query(formattedQuery)) as any[];
    if (rs.length == 0) return undefined;
    return {
      rxcui: Number(rs[0]['RXCUI']) as number,
      str: rs[0]['STR'] as string,
    }; // we take the first one orderd alphabetically
  }

  async lookupByStr(str: string) {
    const formattedQuery = mysql.format(rxStrQuery, [str]);
    const rs = (await query(formattedQuery)) as any[];
    if (rs.length == 0) return undefined;
    return {
      rxcui: Number(rs[0]['RXCUI']) as number,
      str: rs[0]['STR'] as string,
    }; // we take the first one orderd alphabetically
  }
}

export default new MysqlRxNormService();
