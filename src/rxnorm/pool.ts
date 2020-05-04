import mysql from 'mysql';

let pool: mysql.Pool;

export function initPool(args: {
  host: string;
  user: string;
  password: string;
  database: string;
  timeout: number;
  port: number;
}) {
  pool = mysql.createPool({
    connectTimeout: args.timeout,
    database: args.database,
    user: args.user,
    password: args.password,
    port: args.port,
    host: args.host,
  });
  return pool;
}

export function getPool() {
  return pool;
}
