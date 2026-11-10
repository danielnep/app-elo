import pg from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://elo_app:elo_secure_pass_2026@127.0.0.1:5434/elo_db';

export const pool = new pg.Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function q(text, params) {
  return await pool.query(text, params);
}

export async function query(text, params) {
  return await pool.query(text, params);
}

export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function audit(db, userId, action, targetId = null, meta = {}) {
  const client = db && typeof db.query === 'function' ? db : pool;
  try {
    await client.query(
      'INSERT INTO audit_log(user_id, action, target_id, meta) VALUES ($1, $2, $3, $4)',
      [userId, action, targetId ? String(targetId) : null, JSON.stringify(meta || {})]
    );
  } catch (e) {
    console.error('[Audit Error]', e.message);
  }
}

export async function getClient() {
  return await pool.connect();
}
