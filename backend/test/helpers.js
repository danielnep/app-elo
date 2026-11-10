import crypto from 'node:crypto';
// Gera um token de ação diretamente no banco de teste (equivalente ao link enviado por e-mail)
export async function sendTestToken(pool, userId, purpose, minutes = 30) {
  const t = crypto.randomBytes(32).toString('base64url');
  const h = crypto.createHash('sha256').update(t).digest('hex');
  await pool.query(`INSERT INTO action_tokens(user_id, purpose, token_hash, expires_at) VALUES ($1,$2,$3, now() + make_interval(mins => $4))`, [userId, purpose, h, minutes]);
  return t;
}
