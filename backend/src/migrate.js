import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function migrate() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://elo_app:elo_secure_pass_2026@127.0.0.1:5434/elo_db';
  const pool = new pg.Pool({ connectionString });
  const client = await pool.connect();
  try {
    const migrationFile = path.resolve(__dirname, '../migrations/001_init.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// Se rodado diretamente via linha de comando
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('[Migrate] Executando migração...');
  migrate()
    .then(() => console.log('[Migrate] Concluído com sucesso!'))
    .catch(err => {
      console.error('[Migrate] Erro:', err);
      process.exit(1);
    });
}
