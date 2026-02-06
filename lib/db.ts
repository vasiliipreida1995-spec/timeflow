import mysql from "mysql2/promise";
import type { RowDataPacket } from "mysql2";

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? "3306"),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

type DbParam = string | number | boolean | null;

export async function queryDb<T = RowDataPacket[]>(sql: string, params: readonly DbParam[] = []) {
  const [rows] = await pool.execute(sql, params);
  return rows as T;
}

export { pool };
