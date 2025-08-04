export async function queryDB<T>(db: D1Database, sql: string, params: unknown[] = []): Promise<T[]> {
  const stmt = db.prepare(sql);
  const res = await stmt.bind(...params).all<T>();
  if (res.error) throw res.error;
  return res.results as T[];
}

export async function execute(db: D1Database, sql: string, params: unknown[] = []): Promise<void> {
  const stmt = db.prepare(sql);
  const res = await stmt.bind(...params).run();
  if (res.error) throw res.error;
}
