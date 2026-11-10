import crypto from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(crypto.scrypt);

// scrypt N=2^15, r=8, p=1 (parâmetros OWASP), salt 16 bytes
const N = 32768, R = 8, P = 1, KEYLEN = 64, MAXMEM = 64 * 1024 * 1024;
export async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw.normalize('NFKC'), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}
export async function verifyPassword(pw, stored) {
  const [alg, n, r, p, saltB64, keyB64] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scrypt(pw.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length,
    { N: +n, r: +r, p: +p, maxmem: MAXMEM });
  return crypto.timingSafeEqual(key, expected);
}
// Hash fictício para equalizar o tempo de resposta quando o e-mail não existe
export const DUMMY_HASH = await hashPassword(crypto.randomBytes(12).toString('hex'));

export const newToken = () => crypto.randomBytes(32).toString('base64url');
export const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

export function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < 10) return 'A senha precisa ter ao menos 10 caracteres.';
  if (pw.length > 128) return 'A senha pode ter no máximo 128 caracteres.';
  if (!/[A-Za-zÀ-ÿ]/.test(pw) || !/\d/.test(pw)) return 'Use letras e números na senha.';
  return null;
}

const SECRET = () => {
  const s = process.env.TOKEN_SECRET;
  if (!s || s.length < 32) throw new Error('TOKEN_SECRET ausente ou curto');
  return s;
};
// URL de mídia assinada e com validade (fotos não ficam públicas permanentemente)
export function signMedia(photoId, ttlSec = 3600) {
  const exp = Math.floor(Date.now() / 1000 / 600) * 600 + ttlSec; // estável por janelas de 10 min (cache)
  const sig = crypto.createHmac('sha256', SECRET()).update(`${photoId}.${exp}`).digest('base64url');
  return `/api/media/${photoId}?exp=${exp}&sig=${sig}`;
}
export function checkMedia(photoId, exp, sig) {
  if (!exp || !sig || +exp < Date.now() / 1000) return false;
  const good = crypto.createHmac('sha256', SECRET()).update(`${photoId}.${exp}`).digest('base64url');
  const a = Buffer.from(good), b = Buffer.from(String(sig));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function ageFrom(birth, now = new Date()) {
  if (birth instanceof Date) {
    let age = now.getUTCFullYear() - birth.getUTCFullYear();
    const mm = now.getUTCMonth() - birth.getUTCMonth();
    const dd = now.getUTCDate() - birth.getUTCDate();
    if (mm < 0 || (mm === 0 && dd < 0)) age--;
    return age;
  }
  const str = String(birth).slice(0, 10);
  const [y, m, d] = str.split('-').map(Number);
  let age = now.getUTCFullYear() - y;
  const mm = now.getUTCMonth() + 1, dd = now.getUTCDate();
  if (mm < m || (mm === m && dd < d)) age--;
  return age;
}

export const isoDate = d => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
