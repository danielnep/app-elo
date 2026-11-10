import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import helmet from '@fastify/helmet';
import { createReadStream } from 'node:fs';
import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { q, tx, audit } from './db.js';
import {
  hashPassword, verifyPassword, DUMMY_HASH, newToken, sha256, passwordProblem, signMedia, checkMedia, ageFrom, isoDate,
} from './security.js';
import { IDENTITIES, SEEKING_LABELS, PRONOUNS, INTERESTS, CITIES, REPORT_REASONS, TERMS_VERSION } from './constants.js';
import { queueMail, mailEnabled } from './mail.js';

const ACCESS_TTL_MIN = 15, REFRESH_TTL_DAYS = 30;
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/data/uploads';
const PUBLIC_URL = (process.env.PUBLIC_URL || 'https://elo.hzsys.tech').replace(/\/$/, '');
const IDS = Object.keys(IDENTITIES);
const DBQ = { query: (t, p) => q(t, p) };
const err = (code, message, status = 400) => Object.assign(new Error(message), { statusCode: status, code });

// Distância Haversine em km (SQL), usando apenas centros de cidade
const DIST = (a, b) => `(6371 * 2 * asin(sqrt(power(sin(radians(${b}.lat - ${a}.lat) / 2), 2) +
  cos(radians(${a}.lat)) * cos(radians(${b}.lat)) * power(sin(radians(${b}.lng - ${a}.lng) / 2), 2))))`;
// Distância apresentada sempre arredondada para cima em blocos de 5 km
const roundKm = km => (km == null ? null : Math.max(5, Math.ceil(km / 5) * 5));

export async function buildApp(opts = {}) {
  const app = Fastify({
    logger: opts.logger ?? { level: 'info', redact: ['req.headers.authorization', 'req.body'] },
    trustProxy: true, bodyLimit: 64 * 1024,
  });
  await app.register(helmet, { contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-origin' } });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await app.register(multipart, { limits: { fileSize: 6 * 1024 * 1024, files: 1 } });
  await mkdir(UPLOAD_DIR, { recursive: true });

  app.setErrorHandler((e, req, reply) => {
    const status = e.statusCode || 500;
    if (status >= 500) req.log.error({ err: e }, 'erro interno');
    const message = e.validation ? 'Dados inválidos: verifique os campos enviados.' : (status >= 500 ? 'Erro interno. Tente novamente.' : e.message);
    reply.code(status).send({ error: e.code && !String(e.code).startsWith('FST_') ? e.code : (e.validation ? 'validation' : 'error'), message });
  });

  // ---------- autenticação ----------
  async function auth(req) {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) throw err('unauthorized', 'Sessão ausente.', 401);
    const { rows } = await q(`SELECT s.user_id, u.status, u.email, u.email_verified_at, u.birth_date
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.access_hash = $1 AND s.access_expires_at > now()`, [sha256(h.slice(7))]);
    if (!rows[0]) throw err('unauthorized', 'Sessão expirada. Entre novamente.', 401);
    req.user = { id: rows[0].user_id, ...rows[0] };
  }
  async function active(req) {
    await auth(req);
    if (req.user.status !== 'active') throw err('deactivated', 'Conta desativada. Reative em Segurança e privacidade.', 403);
  }
  async function issueSession(db, userId) {
    const access = newToken(), refresh = newToken();
    await db.query(`INSERT INTO sessions(user_id, access_hash, refresh_hash, access_expires_at, refresh_expires_at)
      VALUES ($1,$2,$3, now() + interval '${ACCESS_TTL_MIN} minutes', now() + interval '${REFRESH_TTL_DAYS} days')`,
    [userId, sha256(access), sha256(refresh)]);
    return { access_token: access, refresh_token: refresh, expires_in: ACCESS_TTL_MIN * 60 };
  }
  async function actionToken(userId, purpose, minutes) {
    const t = newToken();
    await q(`UPDATE action_tokens SET used_at = now() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`, [userId, purpose]);
    await q(`INSERT INTO action_tokens(user_id, purpose, token_hash, expires_at) VALUES ($1,$2,$3, now() + make_interval(mins => $4))`,
      [userId, purpose, sha256(t), minutes]);
    return t;
  }
  async function sendVerification(userId, email) {
    const t = await actionToken(userId, 'verify_email', 60 * 24);
    const link = `${PUBLIC_URL}/api/auth/verify-email?token=${t}`;
    return queueMail(userId, 'verify_email', email, {
      subject: 'Confirme seu e-mail no Elo',
      html: `<p>Olá! Confirme seu e-mail no Elo:</p><p><a href="${link}">Confirmar e-mail</a></p><p>O link expira em 24 horas.</p>`,
    });
  }
  async function consumeToken(token, purpose) {
    const { rows } = await q(`UPDATE action_tokens SET used_at = now()
      WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now() RETURNING user_id`, [sha256(String(token)), purpose]);
    return rows[0]?.user_id || null;
  }
  const authLimit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

  app.get('/api/health', async () => {
    await q('SELECT 1');
    return { ok: true, service: 'app-elo-api' };
  });

  app.get('/api/meta', async () => ({
    identities: IDENTITIES, seeking: SEEKING_LABELS, pronouns: PRONOUNS, interests: INTERESTS,
    cities: Object.fromEntries(Object.entries(CITIES).map(([k, v]) => [k, v[0]])),
    report_reasons: REPORT_REASONS, terms_version: TERMS_VERSION,
    google_login_enabled: false, mail_enabled: mailEnabled(), demo_environment: process.env.DEMO_MODE === 'true',
  }));

  app.post('/api/auth/register', { ...authLimit, schema: { body: {
    type: 'object', required: ['display_name', 'email', 'password', 'birth_date', 'accept_terms'], additionalProperties: false,
    properties: {
      display_name: { type: 'string', minLength: 1, maxLength: 40 }, email: { type: 'string', maxLength: 254 },
      password: { type: 'string', maxLength: 128 }, birth_date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      accept_terms: { type: 'boolean' },
    } } } }, async (req, reply) => {
    const { display_name, password, birth_date, accept_terms } = req.body;
    const email = req.body.email.trim().toLowerCase();
    const name = display_name.trim();
    if (!name) throw err('invalid_name', 'Informe seu nome ou apelido.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw err('invalid_email', 'E-mail inválido.');
    const pp = passwordProblem(password); if (pp) throw err('weak_password', pp);
    const bd = new Date(`${birth_date}T00:00:00Z`);
    if (Number.isNaN(bd.getTime()) || bd.toISOString().slice(0, 10) !== birth_date) throw err('invalid_birth', 'Data de nascimento inválida.');
    const age = ageFrom(birth_date);
    if (age < 18) throw err('underage', 'O Elo é exclusivo para maiores de 18 anos.', 403);
    if (age > 110) throw err('invalid_birth', 'Data de nascimento inválida.');
    if (accept_terms !== true) throw err('terms_required', 'É preciso aceitar os termos e a política de privacidade.');
    const hash = await hashPassword(password);
    const out = await tx(async db => {
      const ex = await db.query('SELECT 1 FROM users WHERE lower(email) = $1', [email]);
      if (ex.rows[0]) throw err('email_taken', 'Já existe uma conta com este e-mail.', 409);
      const { rows } = await db.query(`INSERT INTO users(email, password_hash, birth_date, terms_accepted_at, terms_version)
        VALUES ($1,$2,$3, now(), $4) RETURNING id`, [email, hash, birth_date, TERMS_VERSION]);
      const id = rows[0].id;
      await db.query('INSERT INTO profiles(user_id, display_name) VALUES ($1,$2)', [id, name]);
      await db.query('INSERT INTO preferences(user_id) VALUES ($1)', [id]);
      await audit(db, id, 'account.register', id, { terms_version: TERMS_VERSION });
      return { id, ...(await issueSession(db, id)) };
    });
    const sent = await sendVerification(out.id, email);
    reply.code(201);
    return { ...out, verification_email_sent: sent };
  });

  app.post('/api/auth/login', { ...authLimit, schema: { body: { type: 'object', required: ['email', 'password'],
    properties: { email: { type: 'string', maxLength: 254 }, password: { type: 'string', maxLength: 128 } } } } }, async req => {
    const email = req.body.email.trim().toLowerCase();
    const { rows } = await q('SELECT id, password_hash FROM users WHERE lower(email) = $1', [email]);
    const ok = await verifyPassword(req.body.password, rows[0]?.password_hash || DUMMY_HASH);
    if (!rows[0] || !ok) throw err('invalid_credentials', 'E-mail ou senha incorretos.', 401);
    await audit(DBQ, rows[0].id, 'auth.login', rows[0].id);
    return { id: rows[0].id, ...(await issueSession(DBQ, rows[0].id)) };
  });

  app.post('/api/auth/refresh', { ...authLimit, schema: { body: { type: 'object', required: ['refresh_token'],
    properties: { refresh_token: { type: 'string', maxLength: 100 } } } } }, async req => {
    // Rotação: o refresh usado é invalidado e um novo par é emitido
    return tx(async db => {
      const { rows } = await db.query(`DELETE FROM sessions WHERE refresh_hash = $1 AND refresh_expires_at > now() RETURNING user_id`,
        [sha256(req.body.refresh_token)]);
      if (!rows[0]) throw err('unauthorized', 'Sessão expirada. Entre novamente.', 401);
      return { id: rows[0].user_id, ...(await issueSession(db, rows[0].user_id)) };
    });
  });

  app.post('/api/auth/logout', { preHandler: auth }, async req => {
    await q('DELETE FROM sessions WHERE access_hash = $1', [sha256(req.headers.authorization.slice(7))]);
    return { ok: true };
  });

  app.get('/api/auth/verify-email', async (req, reply) => {
    const uid = await consumeToken(req.query.token || '', 'verify_email');
    if (uid) { await q('UPDATE users SET email_verified_at = now() WHERE id = $1', [uid]); await audit(DBQ, uid, 'account.email_verified', uid); }
    reply.type('text/html; charset=utf-8').code(uid ? 200 : 400);
    return `<!doctype html><meta name="viewport" content="width=device-width"><body style="background:#101319;color:#fff;font-family:sans-serif;text-align:center;padding:48px">
      <h1 style="color:${uid ? '#84CFFF' : '#FF84BE'}">${uid ? 'E-mail confirmado 💙💗' : 'Link inválido ou expirado'}</h1>
      <p><a style="color:#F6A1CD" href="${PUBLIC_URL}/">Voltar ao Elo</a></p></body>`;
  });
  app.post('/api/auth/verify-email', { ...authLimit, schema: { body: { type: 'object', required: ['token'], properties: { token: { type: 'string', maxLength: 100 } } } } }, async () => {
    throw err('use_link', 'Abra o link recebido por e-mail para confirmar.', 405);
  });

  app.post('/api/auth/resend-verification', { preHandler: auth, ...authLimit }, async req => {
    if (req.user.email_verified_at) return { ok: true, already_verified: true };
    return { ok: true, verification_email_sent: await sendVerification(req.user.id, req.user.email) };
  });

  app.post('/api/auth/forgot-password', { ...authLimit, schema: { body: { type: 'object', required: ['email'],
    properties: { email: { type: 'string', maxLength: 254 } } } } }, async req => {
    // Resposta idêntica exista ou não a conta (evita enumeração de e-mails)
    const email = req.body.email.trim().toLowerCase();
    const { rows } = await q('SELECT id FROM users WHERE lower(email) = $1', [email]);
    if (rows[0]) {
      const t = await actionToken(rows[0].id, 'reset_password', 30);
      const link = `${PUBLIC_URL}/?reset_token=${t}`;
      await queueMail(rows[0].id, 'reset_password', email, {
        subject: 'Redefinição de senha do Elo',
        html: `<p>Para criar uma nova senha no Elo, acesse:</p><p><a href="${link}">Redefinir senha</a></p><p>O link expira em 30 minutos. Se não foi você, ignore.</p>`,
      });
    }
    return { ok: true, mail_enabled: mailEnabled(),
      message: 'Se houver uma conta com este e-mail, enviaremos um link válido por 30 minutos.' };
  });

  app.post('/api/auth/reset-password', { ...authLimit, schema: { body: { type: 'object', required: ['token', 'password'],
    properties: { token: { type: 'string', maxLength: 100 }, password: { type: 'string', maxLength: 128 } } } } }, async req => {
    const pp = passwordProblem(req.body.password); if (pp) throw err('weak_password', pp);
    const uid = await consumeToken(req.body.token, 'reset_password');
    if (!uid) throw err('invalid_token', 'Link de redefinição inválido ou expirado.');
    await q('UPDATE users SET password_hash = $2 WHERE id = $1', [uid, await hashPassword(req.body.password)]);
    await q('DELETE FROM sessions WHERE user_id = $1', [uid]);
    await audit(DBQ, uid, 'auth.password_reset', uid);
    return { ok: true };
  });

  // ---------- perfil próprio ----------
  async function photosFor(ids) {
    if (!ids.length) return {};
    const { rows } = await q('SELECT id, user_id, position FROM photos WHERE user_id = ANY($1) ORDER BY position, created_at', [ids]);
    const map = {};
    for (const r of rows) (map[r.user_id] ||= []).push({ id: r.id, url: signMedia(r.id), position: r.position });
    return map;
  }
  async function loadMe(uid) {
    const { rows } = await q(`SELECT u.id, u.email, u.email_verified_at, u.status, u.is_demo, u.birth_date, u.created_at,
        p.display_name, p.identity, p.identity_public, p.pronouns, p.pronouns_custom, p.bio, p.interests AS profile_interests,
        p.visible, p.show_distance, p.city_code, p.verification, p.onboarding_step,
        pr.seeking, pr.max_distance_km, pr.age_min, pr.age_max, pr.interests AS pref_interests
      FROM users u JOIN profiles p ON p.user_id = u.id JOIN preferences pr ON pr.user_id = u.id WHERE u.id = $1`, [uid]);
    const r = rows[0];
    if (!r) throw err('not_found', 'Conta não encontrada.', 404);
    return {
      id: r.id, email: r.email, email_verified: !!r.email_verified_at, status: r.status, is_demo: r.is_demo,
      birth_date: isoDate(r.birth_date), age: ageFrom(r.birth_date), created_at: r.created_at,
      onboarding_step: r.onboarding_step,
      profile: {
        display_name: r.display_name, identity: r.identity, identity_public: r.identity_public, pronouns: r.pronouns,
        pronouns_custom: r.pronouns_custom, bio: r.bio, interests: r.profile_interests, visible: r.visible,
        show_distance: r.show_distance, city_code: r.city_code, city: r.city_code ? CITIES[r.city_code][0] : null,
        verification: r.verification,
      },
      preferences: { seeking: r.seeking, max_distance_km: r.max_distance_km, age_min: r.age_min, age_max: r.age_max, interests: r.pref_interests },
      photos: (await photosFor([uid]))[uid] || [],
    };
  }
  app.get('/api/me', { preHandler: auth }, async req => loadMe(req.user.id));

  const interestEnum = { type: 'array', maxItems: 12, uniqueItems: true, items: { type: 'string', enum: Object.keys(INTERESTS) } };
  app.patch('/api/me/profile', { preHandler: active, schema: { body: { type: 'object', additionalProperties: false, minProperties: 1, properties: {
    display_name: { type: 'string', minLength: 1, maxLength: 40 },
    identity: { type: 'string', enum: IDS }, identity_public: { type: 'boolean' },
    pronouns: { type: ['string', 'null'], enum: [...Object.keys(PRONOUNS), null] },
    pronouns_custom: { type: ['string', 'null'], maxLength: 30 },
    bio: { type: 'string', maxLength: 500 }, interests: interestEnum,
    visible: { type: 'boolean' }, show_distance: { type: 'boolean' },
    city_code: { type: ['string', 'null'], enum: [...Object.keys(CITIES), null] },
  } } } }, async req => {
    const b = { ...req.body };
    if (b.display_name !== undefined) { b.display_name = b.display_name.trim(); if (!b.display_name) throw err('invalid_name', 'Informe seu nome ou apelido.'); }
    if (b.pronouns !== undefined && b.pronouns !== 'outro') b.pronouns_custom = null;
    if (b.pronouns === 'outro' && !(b.pronouns_custom || '').trim()) throw err('pronouns_custom', 'Escreva seus pronomes personalizados.');
    if (b.pronouns_custom) b.pronouns_custom = b.pronouns_custom.trim();
    if (b.city_code !== undefined) { const c = b.city_code ? CITIES[b.city_code] : null; b.lat = c ? c[1] : null; b.lng = c ? c[2] : null; }
    const keys = Object.keys(b);
    const sets = keys.map((k, i) => `${k} = $${i + 2}`);
    if (b.identity) sets.push('onboarding_step = GREATEST(onboarding_step, 1)');
    await q(`UPDATE profiles SET ${sets.join(', ')}, updated_at = now() WHERE user_id = $1`, [req.user.id, ...keys.map(k => b[k])]);
    return loadMe(req.user.id);
  });

  app.put('/api/me/preferences', { preHandler: active, schema: { body: { type: 'object', additionalProperties: false,
    required: ['seeking', 'max_distance_km', 'age_min', 'age_max'], properties: {
      seeking: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', enum: IDS } },
      max_distance_km: { type: 'integer', minimum: 1, maximum: 500 },
      age_min: { type: 'integer', minimum: 18, maximum: 99 }, age_max: { type: 'integer', minimum: 18, maximum: 99 },
      interests: interestEnum,
    } } } }, async req => {
    const { seeking, max_distance_km, age_min, age_max, interests = [] } = req.body;
    if (age_min > age_max) throw err('invalid_age', 'Idade mínima maior que a máxima.');
    const me = await loadMe(req.user.id);
    if (!me.profile.identity) throw err('identity_first', 'Conclua a etapa de identidade antes.', 409);
    await q(`UPDATE preferences SET seeking = $2, max_distance_km = $3, age_min = $4, age_max = $5, interests = $6, updated_at = now() WHERE user_id = $1`,
      [req.user.id, seeking, max_distance_km, age_min, age_max, interests]);
    await q('UPDATE profiles SET onboarding_step = GREATEST(onboarding_step, 2) WHERE user_id = $1', [req.user.id]);
    return loadMe(req.user.id);
  });

  // ---------- fotos (consentimento explícito) ----------
  const MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const magicOk = (buf, mime) => (mime === 'image/jpeg' && buf[0] === 0xff && buf[1] === 0xd8)
    || (mime === 'image/png' && buf.subarray(0, 4).toString('hex') === '89504e47')
    || (mime === 'image/webp' && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP');
  app.post('/api/me/photos', { preHandler: active, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const file = await req.file();
    if (!file) throw err('no_file', 'Envie uma imagem.');
    if (file.fields.consent?.value !== 'true') throw err('consent_required', 'Confirme que a foto é sua e que você consente com a publicação.');
    const buf = await file.toBuffer();
    let mime = MIME[file.mimetype] ? file.mimetype : null;
    if (!mime) mime = Object.keys(MIME).find(m => magicOk(buf, m)) || null; // navegadores às vezes enviam octet-stream
    if (!mime || !magicOk(buf, mime)) throw err('invalid_image', 'Formato aceito: JPG, PNG ou WEBP.');
    const { rows: cnt } = await q('SELECT count(*)::int n FROM photos WHERE user_id = $1', [req.user.id]);
    if (cnt[0].n >= 6) throw err('photo_limit', 'Limite de 6 fotos atingido.');
    const name = `${crypto.randomUUID()}.${MIME[mime]}`;
    await writeFile(path.join(UPLOAD_DIR, name), buf, { mode: 0o640 });
    const { rows } = await q(`INSERT INTO photos(user_id, file_name, mime, position, consent_at) VALUES ($1,$2,$3,$4, now()) RETURNING id`,
      [req.user.id, name, mime, cnt[0].n]);
    await audit(DBQ, req.user.id, 'photo.upload', rows[0].id);
    reply.code(201);
    return { id: rows[0].id, url: signMedia(rows[0].id), position: cnt[0].n };
  });
  app.delete('/api/me/photos/:id', { preHandler: auth, schema: { params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } } } }, async req => {
    const { rows } = await q('DELETE FROM photos WHERE id = $1 AND user_id = $2 RETURNING file_name', [req.params.id, req.user.id]);
    if (!rows[0]) throw err('not_found', 'Foto não encontrada.', 404);
    await unlink(path.join(UPLOAD_DIR, rows[0].file_name)).catch(() => {});
    await q(`UPDATE photos p SET position = s.rn - 1 FROM (SELECT id, row_number() OVER (ORDER BY position, created_at) rn FROM photos WHERE user_id = $1) s WHERE p.id = s.id`, [req.user.id]);
    await audit(DBQ, req.user.id, 'photo.delete', req.params.id);
    return loadMe(req.user.id);
  });
  app.get('/api/media/:id', { schema: { params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } } } }, async (req, reply) => {
    if (!checkMedia(req.params.id, req.query.exp, req.query.sig)) throw err('forbidden', 'Link de mídia inválido.', 403);
    const { rows } = await q('SELECT file_name, mime FROM photos WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw err('not_found', 'Mídia não encontrada.', 404);
    reply.header('Cache-Control', 'private, max-age=600').header('Cross-Origin-Resource-Policy', 'cross-origin').type(rows[0].mime);
    return reply.send(createReadStream(path.join(UPLOAD_DIR, rows[0].file_name)));
  });

  // ---------- descoberta ----------
  // Compatibilidade recíproca: a identidade de cada pessoa precisa estar entre os gêneros buscados pela outra,
  // e a idade de cada uma dentro da faixa da outra. Bloqueios em qualquer direção excluem o perfil.
  const BASE = `FROM users u JOIN profiles p ON p.user_id = u.id JOIN preferences cp ON cp.user_id = u.id,
      users mu JOIN profiles mp ON mp.user_id = mu.id JOIN preferences mpr ON mpr.user_id = mu.id
    WHERE mu.id = $1 AND u.id <> mu.id AND u.status = 'active' AND p.visible AND p.onboarding_step >= 2
      AND p.identity = ANY(mpr.seeking) AND mp.identity = ANY(cp.seeking)
      AND date_part('year', age(u.birth_date)) BETWEEN mpr.age_min AND mpr.age_max
      AND date_part('year', age(mu.birth_date)) BETWEEN cp.age_min AND cp.age_max
      AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = mu.id AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = mu.id))`;
  const DISTANCE_FILTER = `AND (mp.lat IS NULL OR (p.lat IS NOT NULL AND ${DIST('mp', 'p')} <= mpr.max_distance_km))`;
  const INTEREST_FILTER = `AND (cardinality(mpr.interests) = 0 OR p.interests && mpr.interests)`;
  const PUB_COLS = `u.id, u.is_demo, u.birth_date, p.display_name, p.identity, p.identity_public, p.pronouns, p.pronouns_custom,
      p.bio, p.interests, p.verification, p.show_distance,
      CASE WHEN mp.lat IS NOT NULL AND p.lat IS NOT NULL THEN ${DIST('mp', 'p')} END AS km`;
  async function toPublic(rows) {
    const photos = await photosFor(rows.map(r => r.id));
    return rows.map(r => ({
      id: r.id, display_name: r.display_name, age: ageFrom(r.birth_date),
      identity: r.identity_public ? r.identity : null,
      pronouns: r.pronouns === 'outro' ? r.pronouns_custom : (r.pronouns && r.pronouns !== 'nao_informar' ? PRONOUNS[r.pronouns] : null),
      bio: r.bio, interests: r.interests, verified: r.verification === 'verified', is_demo: r.is_demo,
      distance_km: r.show_distance ? roundKm(r.km) : null, photos: photos[r.id] || [],
      ...(r.match_id ? { match_id: r.match_id } : {}),
    }));
  }
  async function requireOnboarded(uid) {
    const { rows } = await q('SELECT onboarding_step FROM profiles WHERE user_id = $1', [uid]);
    if ((rows[0]?.onboarding_step ?? 0) < 2) throw err('onboarding_incomplete', 'Conclua identidade e preferências para descobrir perfis.', 409);
  }
  app.get('/api/discover', { preHandler: active }, async req => {
    await requireOnboarded(req.user.id);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 30);
    const { rows } = await q(`SELECT ${PUB_COLS} ${BASE} ${DISTANCE_FILTER} ${INTEREST_FILTER}
      AND NOT EXISTS (SELECT 1 FROM swipes s WHERE s.from_user = mu.id AND s.to_user = u.id)
      ORDER BY cardinality(ARRAY(SELECT unnest(p.interests) INTERSECT SELECT unnest(mp.interests))) DESC, u.created_at DESC
      LIMIT $2`, [req.user.id, limit]);
    return { profiles: await toPublic(rows) };
  });

  app.get('/api/users/:id', { preHandler: active, schema: { params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } } } }, async req => {
    // Visível se compatível (mesmas regras da descoberta) ou se há match ativo entre as duas contas
    const { rows } = await q(`SELECT ${PUB_COLS}, m.id AS match_id
      FROM users u JOIN profiles p ON p.user_id = u.id JOIN preferences cp ON cp.user_id = u.id
        LEFT JOIN matches m ON m.active AND ((m.user_a = u.id AND m.user_b = $1) OR (m.user_b = u.id AND m.user_a = $1)),
        users mu JOIN profiles mp ON mp.user_id = mu.id JOIN preferences mpr ON mpr.user_id = mu.id
      WHERE mu.id = $1 AND u.id = $2 AND u.id <> mu.id AND u.status = 'active' AND p.onboarding_step >= 2
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = mu.id AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = mu.id))
        AND (m.id IS NOT NULL OR (p.visible AND p.identity = ANY(mpr.seeking) AND mp.identity = ANY(cp.seeking)
          AND date_part('year', age(u.birth_date)) BETWEEN mpr.age_min AND mpr.age_max
          AND date_part('year', age(mu.birth_date)) BETWEEN cp.age_min AND cp.age_max))`, [req.user.id, req.params.id]);
    if (!rows[0]) throw err('not_found', 'Perfil indisponível.', 404);
    return (await toPublic(rows))[0];
  });

  // ---------- curtidas e match ----------
  const uidBody = { type: 'object', required: ['user_id'], properties: { user_id: { type: 'string', format: 'uuid' } } };
  app.post('/api/swipes', { preHandler: active, config: { rateLimit: { max: 120, timeWindow: '1 minute' } }, schema: { body: {
    ...uidBody, required: ['user_id', 'kind'], properties: { ...uidBody.properties, kind: { type: 'string', enum: ['like', 'pass'] } } } } }, async req => {
    await requireOnboarded(req.user.id);
    const me = req.user.id, other = req.body.user_id, kind = req.body.kind;
    if (me === other) throw err('self', 'Ação inválida.');
    return tx(async db => {
      const [a, b] = me < other ? [me, other] : [other, me];
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${a}:${b}`]); // serializa curtidas do mesmo par
      const ok = await db.query(`SELECT 1 ${BASE} AND u.id = $2`, [me, other]);
      if (!ok.rows[0]) throw err('not_available', 'Perfil indisponível.', 404);
      await db.query(`INSERT INTO swipes(from_user, to_user, kind) VALUES ($1,$2,$3)
        ON CONFLICT (from_user, to_user) DO UPDATE SET kind = EXCLUDED.kind, created_at = now()`, [me, other, kind]);
      if (kind !== 'like') return { matched: false };
      const back = await db.query(`SELECT 1 FROM swipes WHERE from_user = $1 AND to_user = $2 AND kind = 'like'`, [other, me]);
      if (!back.rows[0]) return { matched: false };
      const m = await db.query(`INSERT INTO matches(user_a, user_b) VALUES ($1,$2) ON CONFLICT (user_a, user_b) DO NOTHING RETURNING id`, [a, b]);
      let matchId = m.rows[0]?.id;
      if (matchId) await audit(db, me, 'match.created', matchId);
      else matchId = (await db.query('SELECT id FROM matches WHERE user_a = $1 AND user_b = $2 AND active', [a, b])).rows[0]?.id;
      return { matched: !!matchId, match_id: matchId || null };
    });
  });
  app.delete('/api/swipes/:userId', { preHandler: active, schema: { params: { type: 'object', properties: { userId: { type: 'string', format: 'uuid' } } } } }, async req => {
    const [a, b] = req.user.id < req.params.userId ? [req.user.id, req.params.userId] : [req.params.userId, req.user.id];
    const m = await q('SELECT 1 FROM matches WHERE user_a = $1 AND user_b = $2 AND active', [a, b]);
    if (m.rows[0]) throw err('already_matched', 'Já existe match com este perfil.', 409);
    const { rowCount } = await q('DELETE FROM swipes WHERE from_user = $1 AND to_user = $2', [req.user.id, req.params.userId]);
    return { ok: rowCount > 0 };
  });

  const MATCH_OF = `SELECT m.id, m.user_a, m.user_b FROM matches m WHERE m.id = $1 AND m.active AND ($2 IN (m.user_a, m.user_b))
    AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = m.user_a AND b.blocked_id = m.user_b) OR (b.blocker_id = m.user_b AND b.blocked_id = m.user_a))`;
  async function myMatch(matchId, uid) {
    const { rows } = await q(MATCH_OF, [matchId, uid]);
    if (!rows[0]) throw err('no_match', 'Conversa indisponível: é preciso um match ativo.', 403);
    return { ...rows[0], other: rows[0].user_a === uid ? rows[0].user_b : rows[0].user_a };
  }
  app.get('/api/matches', { preHandler: active }, async req => {
    const { rows } = await q(`SELECT m.id AS match_id, m.created_at AS matched_at, ${PUB_COLS},
        (SELECT row_to_json(x) FROM (SELECT body, sender_id, created_at FROM messages WHERE match_id = m.id ORDER BY id DESC LIMIT 1) x) AS last_message,
        (SELECT count(*)::int FROM messages WHERE match_id = m.id AND sender_id <> $1 AND read_at IS NULL) AS unread
      FROM matches m JOIN users u ON u.id = CASE WHEN m.user_a = $1 THEN m.user_b ELSE m.user_a END
        JOIN profiles p ON p.user_id = u.id, profiles mp
      WHERE mp.user_id = $1 AND m.active AND $1 IN (m.user_a, m.user_b) AND u.status = 'active'
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = $1 AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = $1))
      ORDER BY COALESCE((SELECT max(created_at) FROM messages WHERE match_id = m.id), m.created_at) DESC`, [req.user.id]);
    const pubs = await toPublic(rows);
    return { matches: rows.map((r, i) => ({ match_id: r.match_id, matched_at: r.matched_at, user: pubs[i],
      last_message: r.last_message ? { ...r.last_message, mine: r.last_message.sender_id === req.user.id } : null, unread: r.unread })) };
  });

  // ---------- chat (somente com match ativo) ----------
  const midParams = { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } };
  app.get('/api/matches/:id/messages', { preHandler: active, schema: { params: midParams } }, async req => {
    const m = await myMatch(req.params.id, req.user.id);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
    const after = parseInt(req.query.after, 10), before = parseInt(req.query.before, 10);
    let rows;
    if (after) rows = (await q(`SELECT id, sender_id, body, created_at, read_at FROM messages WHERE match_id = $1 AND id > $2 ORDER BY id LIMIT $3`, [m.id, after, limit])).rows;
    else rows = (await q(`SELECT * FROM (SELECT id, sender_id, body, created_at, read_at FROM messages WHERE match_id = $1 ${before ? 'AND id < $3' : ''}
      ORDER BY id DESC LIMIT $2) x ORDER BY id`, before ? [m.id, limit, before] : [m.id, limit])).rows;
    await q('UPDATE messages SET read_at = now() WHERE match_id = $1 AND sender_id <> $2 AND read_at IS NULL', [m.id, req.user.id]);
    return { messages: rows.map(r => ({ id: Number(r.id), body: r.body, created_at: r.created_at, mine: r.sender_id === req.user.id, read: !!r.read_at })),
      has_more: !after && rows.length === limit };
  });
  app.post('/api/matches/:id/messages', { preHandler: active, config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    schema: { params: midParams, body: { type: 'object', required: ['body'], properties: { body: { type: 'string', minLength: 1, maxLength: 2000 } } } } }, async (req, reply) => {
    const m = await myMatch(req.params.id, req.user.id);
    const body = req.body.body.trim();
    if (!body) throw err('empty', 'Mensagem vazia.');
    const { rows } = await q('INSERT INTO messages(match_id, sender_id, body) VALUES ($1,$2,$3) RETURNING id, created_at', [m.id, req.user.id, body]);
    reply.code(201);
    return { id: Number(rows[0].id), body, created_at: rows[0].created_at, mine: true, read: false };
  });

  // ---------- bloqueio e denúncia ----------
  async function doBlock(db, me, other) {
    await db.query('INSERT INTO blocks(blocker_id, blocked_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [me, other]);
    const [a, b] = me < other ? [me, other] : [other, me];
    await db.query('UPDATE matches SET active = false, ended_at = now() WHERE user_a = $1 AND user_b = $2 AND active', [a, b]);
    await audit(db, me, 'user.block', other);
  }
  app.post('/api/blocks', { preHandler: auth, schema: { body: uidBody } }, async req => {
    if (req.body.user_id === req.user.id) throw err('self', 'Ação inválida.');
    const ex = await q('SELECT 1 FROM users WHERE id = $1', [req.body.user_id]);
    if (!ex.rows[0]) throw err('not_found', 'Usuário não encontrado.', 404);
    await tx(db => doBlock(db, req.user.id, req.body.user_id));
    return { ok: true };
  });
  app.get('/api/blocks', { preHandler: auth }, async req => {
    const { rows } = await q(`SELECT b.blocked_id AS id, p.display_name, b.created_at FROM blocks b JOIN profiles p ON p.user_id = b.blocked_id
      WHERE b.blocker_id = $1 ORDER BY b.created_at DESC`, [req.user.id]);
    return { blocks: rows };
  });
  app.delete('/api/blocks/:id', { preHandler: auth, schema: { params: midParams } }, async req => {
    await q('DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2', [req.user.id, req.params.id]);
    await audit(DBQ, req.user.id, 'user.unblock', req.params.id);
    return { ok: true }; // o match encerrado não é reativado
  });
  app.post('/api/reports', { preHandler: auth, config: { rateLimit: { max: 10, timeWindow: '1 minute' } }, schema: { body: {
    type: 'object', required: ['user_id', 'reason'], additionalProperties: false, properties: {
      user_id: { type: 'string', format: 'uuid' }, reason: { type: 'string', enum: Object.keys(REPORT_REASONS) },
      details: { type: 'string', maxLength: 1000 }, also_block: { type: 'boolean' } } } } }, async (req, reply) => {
    if (req.body.user_id === req.user.id) throw err('self', 'Ação inválida.');
    const ex = await q('SELECT 1 FROM users WHERE id = $1', [req.body.user_id]);
    if (!ex.rows[0]) throw err('not_found', 'Usuário não encontrado.', 404);
    const id = await tx(async db => {
      const { rows } = await db.query('INSERT INTO reports(reporter_id, reported_id, reason, details) VALUES ($1,$2,$3,$4) RETURNING id',
        [req.user.id, req.body.user_id, req.body.reason, req.body.details?.trim() || null]);
      await audit(db, req.user.id, 'report.create', rows[0].id, { reason: req.body.reason });
      if (req.body.also_block) await doBlock(db, req.user.id, req.body.user_id);
      return rows[0].id;
    });
    reply.code(201);
    return { id, status: 'aberta' };
  });

  // ---------- verificação, LGPD e conta ----------
  app.post('/api/me/verification', { preHandler: active }, async req => {
    const me = await loadMe(req.user.id);
    if (me.profile.verification === 'verified') return { verification: 'verified' };
    if (!me.photos.length) throw err('photo_required', 'Adicione ao menos uma foto sua antes de solicitar verificação.');
    await q(`UPDATE profiles SET verification = 'pending' WHERE user_id = $1`, [req.user.id]);
    await audit(DBQ, req.user.id, 'verification.request', req.user.id);
    return { verification: 'pending' };
  });
  app.get('/api/me/export', { preHandler: auth, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    const uid = req.user.id;
    const me = await loadMe(uid);
    const [sw, mt, msg, bl, rp] = await Promise.all([
      q('SELECT to_user, kind, created_at FROM swipes WHERE from_user = $1', [uid]),
      q('SELECT id, active, created_at, ended_at FROM matches WHERE $1 IN (user_a, user_b)', [uid]),
      q('SELECT match_id, body, created_at FROM messages WHERE sender_id = $1 ORDER BY id', [uid]),
      q('SELECT blocked_id, created_at FROM blocks WHERE blocker_id = $1', [uid]),
      q('SELECT reported_id, reason, details, status, created_at FROM reports WHERE reporter_id = $1', [uid]),
    ]);
    await audit(DBQ, uid, 'lgpd.export', uid);
    reply.header('Content-Disposition', 'attachment; filename="meus-dados-elo.json"');
    return { exported_at: new Date().toISOString(), account: me, swipes: sw.rows, matches: mt.rows, messages_sent: msg.rows,
      blocks: bl.rows, reports_made: rp.rows };
  });
  app.post('/api/me/deactivate', { preHandler: auth }, async req => {
    await q(`UPDATE users SET status = 'deactivated' WHERE id = $1`, [req.user.id]);
    await audit(DBQ, req.user.id, 'account.deactivate', req.user.id);
    return loadMe(req.user.id);
  });
  app.post('/api/me/reactivate', { preHandler: auth }, async req => {
    await q(`UPDATE users SET status = 'active' WHERE id = $1`, [req.user.id]);
    await audit(DBQ, req.user.id, 'account.reactivate', req.user.id);
    return loadMe(req.user.id);
  });
  app.delete('/api/me', { preHandler: auth, config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    schema: { body: { type: 'object', required: ['password'], properties: { password: { type: 'string', maxLength: 128 } } } } }, async req => {
    const { rows } = await q('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!(await verifyPassword(req.body.password, rows[0].password_hash))) throw err('invalid_password', 'Senha incorreta.', 401);
    const files = (await q('SELECT file_name FROM photos WHERE user_id = $1', [req.user.id])).rows;
    await tx(async db => {
      await audit(db, null, 'account.delete', null, {}); // sem identificador pessoal após exclusão
      await db.query('DELETE FROM users WHERE id = $1', [req.user.id]);
    });
    await Promise.all(files.map(f => unlink(path.join(UPLOAD_DIR, f.file_name)).catch(() => {})));
    return { ok: true, deleted: true };
  });

  app.get('/api/openapi.yaml', async (req, reply) => {
    const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'openapi.yaml');
    reply.type('text/yaml; charset=utf-8');
    return readFile(file, 'utf8');
  });
  return app;
}
