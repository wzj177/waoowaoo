import mysql from 'mysql2/promise'

function parseDatabaseUrl(url: string): mysql.PoolOptions {
  // Parse mysql://user:password@host:port/database[?params]
  const u = new URL(url)
  return {
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 3306,
    user: u.username ? decodeURIComponent(u.username) : undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    database: u.pathname.replace(/^\//, ''),
    waitForConnections: true,
    connectionLimit: 5,
    timezone: '+00:00',
  }
}

let pool: mysql.Pool | null = null

export function getDb(): mysql.Pool {
  if (pool) return pool

  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  pool = mysql.createPool(parseDatabaseUrl(url))
  return pool
}

export async function query<T = unknown>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const db = getDb()
  const [rows] = await db.execute(sql, params)
  return rows as T[]
}

export async function queryOne<T = unknown>(
  sql: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}
