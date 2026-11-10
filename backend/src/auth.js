import crypto from 'node:crypto';
import { query } from './db.js';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${key}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

export function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function isAdult(birthDateString) {
  const birth = new Date(birthDateString);
  if (isNaN(birth.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 18;
}

export async function createSession(userId, userAgent = '', ip = '') {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const ipHash = ip ? crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16) : null;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dias

  await query(
    `INSERT INTO sessions (token_hash, user_id, user_agent, ip_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [tokenHash, userId, userAgent, ipHash, expiresAt]
  );

  return { token, expiresAt };
}

export async function authenticateRequest(request, reply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Token de autenticação obrigatório' });
    return null;
  }

  const token = authHeader.slice(7).trim();
  const tokenHash = hashToken(token);

  const res = await query(
    `SELECT s.id as session_id, s.expires_at, u.id, u.email, u.status, u.is_demo,
            p.name, p.identity, p.pronouns, p.is_verified, p.is_visible
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active'`,
    [tokenHash]
  );

  if (res.rows.length === 0) {
    reply.code(401).send({ error: 'Sessão inválida ou expirada' });
    return null;
  }

  const user = res.rows[0];
  request.user = user;
  return user;
}
