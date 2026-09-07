import mysql from "mysql2/promise";

declare global {
  var _mysqlPool: mysql.Pool | undefined;
}

function createPool() {
  return mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
  });
}

// Reuse the pool across hot-reloads in dev; Next.js re-evaluates modules per request otherwise.
export const pool = global._mysqlPool ?? createPool();
if (process.env.NODE_ENV !== "production") {
  global._mysqlPool = pool;
}

export async function query<T = unknown>(sql: string, params?: unknown[]): Promise<T> {
  const [rows] = await pool.query(sql, params);
  return rows as T;
}
