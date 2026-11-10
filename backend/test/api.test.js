// Testes de integração contra PostgreSQL real (DATABASE_URL de teste)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

process.env.TOKEN_SECRET ||= 'teste-'.repeat(8);
process.env.UPLOAD_DIR = await mkdtemp(path.join(os.tmpdir(), 'elo-up-'));
const { pool } = await import('../src/db.js');
const { migrate } = await import('../src/migrate.js');
const { buildApp } = await import('../src/app.js');

let app;
const PW = 'SenhaForte123';
before(async () => {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate();
  app = await buildApp({ logger: process.env.TEST_LOG ? { level: 'error' } : false });
});
after(async () => { await app.close(); await pool.end(); });

const call = async (method, url, { token, body, ip } = {}) => {
  const r = await app.inject({ method, url, payload: body, remoteAddress: ip || `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    headers: token ? { authorization: `Bearer ${token}` } : {} });
  return { status: r.statusCode, body: r.headers['content-type']?.includes('json') ? r.json() : r.body };
};
const years = n => { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - n); d.setUTCDate(d.getUTCDate() - 2); return d.toISOString().slice(0, 10); };
async function account(name, identity, seeking, extra = {}) {
  const r = await call('POST', '/api/auth/register', { body: { display_name: name, email: `${name.toLowerCase()}@teste.elo`, password: PW, birth_date: years(extra.age || 28), accept_terms: true } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const t = r.body.access_token;
  assert.equal((await call('PATCH', '/api/me/profile', { token: t, body: { identity, pronouns: 'ela_dela', city_code: extra.city || 'sao_paulo', interests: ['musica'] } })).status, 200);
  const p = await call('PUT', '/api/me/preferences', { token: t, body: { seeking, max_distance_km: 50, age_min: 18, age_max: 60 } });
  assert.equal(p.status, 200);
  return { id: r.body.id, token: t, refresh: r.body.refresh_token };
}

test('cadastro exige +18, termos, senha forte e e-mail único', async () => {
  const base = { display_name: 'Ana', email: 'ana@teste.elo', password: PW, birth_date: years(28), accept_terms: true };
  assert.equal((await call('POST', '/api/auth/register', { body: { ...base, birth_date: years(17) } })).body.error, 'underage');
  assert.equal((await call('POST', '/api/auth/register', { body: { ...base, accept_terms: false } })).body.error, 'terms_required');
  assert.equal((await call('POST', '/api/auth/register', { body: { ...base, password: 'curta' } })).body.error, 'weak_password');
  const ok = await call('POST', '/api/auth/register', { body: base });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.verification_email_sent, false); // sem provedor configurado, nada é simulado
  assert.equal((await call('POST', '/api/auth/register', { body: { ...base, email: 'ANA@teste.elo' } })).status, 409);
  const { rows } = await pool.query("SELECT password_hash FROM users WHERE email = 'ana@teste.elo'");
  assert.match(rows[0].password_hash, /^scrypt\$/);
  assert.ok(!rows[0].password_hash.includes(PW));
});

test('login, refresh com rotação, logout e verificação de e-mail por link', async () => {
  assert.equal((await call('POST', '/api/auth/login', { body: { email: 'ana@teste.elo', password: 'errada12345' } })).status, 401);
  const l = await call('POST', '/api/auth/login', { body: { email: 'Ana@teste.elo', password: PW } });
  assert.equal(l.status, 200);
  const r1 = await call('POST', '/api/auth/refresh', { body: { refresh_token: l.body.refresh_token } });
  assert.equal(r1.status, 200);
  assert.equal((await call('POST', '/api/auth/refresh', { body: { refresh_token: l.body.refresh_token } })).status, 401);
  assert.equal((await call('GET', '/api/me', { token: l.body.access_token })).status, 401); // sessão antiga foi substituída
  const me = await call('GET', '/api/me', { token: r1.body.access_token });
  assert.equal(me.body.email_verified, false);
  // token real gerado pelo servidor: lido do banco apenas no teste (hash não permite reverter, então gera-se novo)
  const { sendTestToken } = await import('./helpers.js');
  const tok = await sendTestToken(pool, me.body.id, 'verify_email');
  const v = await call('GET', `/api/auth/verify-email?token=${tok}`);
  assert.equal(v.status, 200);
  assert.equal((await call('GET', `/api/auth/verify-email?token=${tok}`)).status, 400); // uso único
  assert.equal((await call('GET', '/api/me', { token: r1.body.access_token })).body.email_verified, true);
  assert.equal((await call('POST', '/api/auth/logout', { token: r1.body.access_token })).status, 200);
  assert.equal((await call('GET', '/api/me', { token: r1.body.access_token })).status, 401);
});

test('recuperação de senha: resposta neutra, token expira e é de uso único', async () => {
  const neutral = await call('POST', '/api/auth/forgot-password', { body: { email: 'naoexiste@teste.elo' } });
  assert.equal(neutral.status, 200);
  const real = await call('POST', '/api/auth/forgot-password', { body: { email: 'ana@teste.elo' } });
  assert.equal(real.body.message, neutral.body.message);
  const { sendTestToken } = await import('./helpers.js');
  const { rows } = await pool.query("SELECT id FROM users WHERE email = 'ana@teste.elo'");
  const expired = await sendTestToken(pool, rows[0].id, 'reset_password', -1);
  assert.equal((await call('POST', '/api/auth/reset-password', { body: { token: expired, password: 'NovaSenha456' } })).status, 400);
  const tok = await sendTestToken(pool, rows[0].id, 'reset_password');
  assert.equal((await call('POST', '/api/auth/reset-password', { body: { token: tok, password: 'NovaSenha456' } })).status, 200);
  assert.equal((await call('POST', '/api/auth/reset-password', { body: { token: tok, password: 'NovaSenha789' } })).status, 400);
  assert.equal((await call('POST', '/api/auth/login', { body: { email: 'ana@teste.elo', password: 'NovaSenha456' } })).status, 200);
});

test('identidade e preferências são independentes e persistidas', async () => {
  const l = await call('POST', '/api/auth/login', { body: { email: 'ana@teste.elo', password: 'NovaSenha456' } });
  const t = l.body.access_token;
  assert.equal((await call('PUT', '/api/me/preferences', { token: t, body: { seeking: ['homem_cis'], max_distance_km: 50, age_min: 18, age_max: 40 } })).status, 409);
  const p = await call('PATCH', '/api/me/profile', { token: t, body: { identity: 'mulher_trans', pronouns: 'outro', pronouns_custom: 'ela/delu' } });
  assert.equal(p.body.profile.identity, 'mulher_trans');
  assert.deepEqual(p.body.preferences.seeking, []); // identidade não define quem a pessoa busca
  assert.equal((await call('PATCH', '/api/me/profile', { token: t, body: { identity: 'nao_binario' } })).status, 400);
  const pr = await call('PUT', '/api/me/preferences', { token: t, body: { seeking: ['homem_cis', 'mulher_trans', 'homem_trans'], max_distance_km: 30, age_min: 21, age_max: 45 } });
  assert.equal(pr.status, 200);
  const me = await call('GET', '/api/me', { token: t });
  assert.deepEqual(me.body.preferences.seeking, ['homem_cis', 'mulher_trans', 'homem_trans']);
  assert.equal(me.body.profile.pronouns_custom, 'ela/delu');
  assert.equal(me.body.onboarding_step, 2);
  assert.equal((await call('PUT', '/api/me/preferences', { token: t, body: { seeking: [], max_distance_km: 30, age_min: 18, age_max: 45 } })).status, 400);
});

let bia, leo, caio, rio;
test('descoberta respeita compatibilidade recíproca, distância e não mostra a si', async () => {
  bia = await account('Bia', 'mulher_trans', ['homem_trans', 'homem_cis']);
  leo = await account('Leo', 'homem_trans', ['mulher_trans']);
  caio = await account('Caio', 'homem_cis', ['mulher_cis']); // não busca mulheres trans → não aparece para Bia
  rio = await account('Rio', 'homem_trans', ['mulher_trans'], { city: 'manaus' }); // fora do raio de 50 km
  const d = await call('GET', '/api/discover', { token: bia.token });
  const ids = d.body.profiles.map(p => p.id);
  assert.ok(ids.includes(leo.id));
  assert.ok(!ids.includes(caio.id), 'incompatível não pode aparecer');
  assert.ok(!ids.includes(rio.id), 'fora da distância');
  assert.ok(!ids.includes(bia.id));
  const leoCard = d.body.profiles.find(p => p.id === leo.id);
  assert.equal(leoCard.distance_km, 5);
  assert.equal(leoCard.verified, false);
  assert.ok(!('email' in leoCard) && !('birth_date' in leoCard) && !('lat' in leoCard));
  // filtro de interesse altera resultados
  await call('PUT', '/api/me/preferences', { token: bia.token, body: { seeking: ['homem_trans'], max_distance_km: 50, age_min: 18, age_max: 60, interests: ['games'] } });
  assert.equal((await call('GET', '/api/discover', { token: bia.token })).body.profiles.length, 0);
  await call('PUT', '/api/me/preferences', { token: bia.token, body: { seeking: ['homem_trans'], max_distance_km: 5000 > 500 ? 500 : 50, age_min: 18, age_max: 60 } });
  assert.ok((await call('GET', '/api/discover', { token: bia.token })).body.profiles.map(p => p.id).includes(leo.id));
  await call('PUT', '/api/me/preferences', { token: bia.token, body: { seeking: ['homem_trans'], max_distance_km: 50, age_min: 18, age_max: 60 } });
});

test('match só com curtida recíproca, sem duplicatas, chat só com match', async () => {
  assert.equal((await call('POST', '/api/swipes', { token: bia.token, body: { user_id: caio.id, kind: 'like' } })).status, 404);
  const first = await call('POST', '/api/swipes', { token: bia.token, body: { user_id: leo.id, kind: 'like' } });
  assert.equal(first.body.matched, false);
  assert.ok(!(await call('GET', '/api/discover', { token: bia.token })).body.profiles.some(p => p.id === leo.id), 'já curtido sai do feed');
  assert.equal((await call('GET', '/api/matches', { token: bia.token })).body.matches.length, 0);
  // curtidas simultâneas não geram match duplicado
  const [x, y] = await Promise.all([
    call('POST', '/api/swipes', { token: leo.token, body: { user_id: bia.id, kind: 'like' } }),
    call('POST', '/api/swipes', { token: leo.token, body: { user_id: bia.id, kind: 'like' } }),
  ]);
  assert.ok(x.body.matched && y.body.matched);
  assert.equal(x.body.match_id, y.body.match_id);
  const { rows } = await pool.query('SELECT count(*)::int n FROM matches');
  assert.equal(rows[0].n, 1);
  const mid = x.body.match_id;
  assert.equal((await call('DELETE', `/api/swipes/${leo.id}`, { token: bia.token })).status, 409);
  // chat
  const s = await call('POST', `/api/matches/${mid}/messages`, { token: bia.token, body: { body: 'Oi, Leo! 💗' } });
  assert.equal(s.status, 201);
  const list = await call('GET', `/api/matches/${mid}/messages`, { token: leo.token });
  assert.equal(list.body.messages[0].body, 'Oi, Leo! 💗');
  assert.equal(list.body.messages[0].mine, false);
  const after = await call('GET', `/api/matches/${mid}/messages?after=${list.body.messages[0].id}`, { token: leo.token });
  assert.equal(after.body.messages.length, 0);
  // terceiro não acessa
  assert.equal((await call('GET', `/api/matches/${mid}/messages`, { token: caio.token })).status, 403);
  assert.equal((await call('POST', `/api/matches/${mid}/messages`, { token: caio.token, body: { body: 'invasão' } })).status, 403);
  const ml = await call('GET', '/api/matches', { token: leo.token });
  assert.equal(ml.body.matches[0].user.id, bia.id);
  assert.equal(ml.body.matches[0].last_message.body, 'Oi, Leo! 💗');
  // perfil completo acessível ao match
  assert.equal((await call('GET', `/api/users/${bia.id}`, { token: leo.token })).body.match_id, mid);
  assert.equal((await call('GET', `/api/users/${bia.id}`, { token: caio.token })).status, 404);
});

test('bloqueio encerra match, impede chat e some da descoberta; denúncia registrada com auditoria', async () => {
  const mid = (await call('GET', '/api/matches', { token: bia.token })).body.matches[0].match_id;
  const r = await call('POST', '/api/reports', { token: bia.token, body: { user_id: leo.id, reason: 'assedio', details: 'teste', also_block: true } });
  assert.equal(r.status, 201);
  assert.equal((await call('POST', `/api/matches/${mid}/messages`, { token: leo.token, body: { body: 'oi?' } })).status, 403);
  assert.equal((await call('GET', '/api/matches', { token: leo.token })).body.matches.length, 0);
  assert.equal((await call('GET', `/api/users/${bia.id}`, { token: leo.token })).status, 404);
  assert.equal((await call('POST', '/api/swipes', { token: leo.token, body: { user_id: bia.id, kind: 'like' } })).status, 404);
  const a = await pool.query("SELECT action, meta FROM audit_log WHERE action IN ('report.create','user.block') ORDER BY id");
  assert.deepEqual(a.rows.map(x => x.action), ['report.create', 'user.block']);
  assert.ok(!JSON.stringify(a.rows).includes('teste'), 'auditoria sem conteúdo sensível');
  assert.equal((await call('POST', '/api/reports', { token: bia.token, body: { user_id: leo.id, reason: 'invalido' } })).status, 400);
  // desbloquear não reativa match
  await call('DELETE', `/api/blocks/${leo.id}`, { token: bia.token });
  assert.equal((await call('GET', '/api/matches', { token: bia.token })).body.matches.length, 0);
});

test('fotos exigem consentimento, URLs assinadas; verificação nunca automática', async () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a8f30000000049454e44ae426082', 'hex');
  const form = (consent) => {
    const b = '----elo' + Date.now();
    const body = Buffer.concat([
      Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="consent"\r\n\r\n${consent}\r\n--${b}\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`),
      png, Buffer.from(`\r\n--${b}--\r\n`)]);
    return { body, headers: { 'content-type': `multipart/form-data; boundary=${b}`, authorization: `Bearer ${bia.token}` } };
  };
  assert.equal((await call('POST', '/api/me/verification', { token: bia.token })).body.error, 'photo_required');
  const no = form('false');
  assert.equal((await app.inject({ method: 'POST', url: '/api/me/photos', payload: no.body, headers: no.headers })).statusCode, 400);
  const yes = form('true');
  const up = await app.inject({ method: 'POST', url: '/api/me/photos', payload: yes.body, headers: yes.headers });
  assert.equal(up.statusCode, 201, up.body);
  const url = up.json().url;
  assert.equal((await app.inject({ method: 'GET', url })).statusCode, 200);
  assert.equal((await app.inject({ method: 'GET', url: url.replace(/sig=.*/, 'sig=forjada') })).statusCode, 403);
  const v = await call('POST', '/api/me/verification', { token: bia.token });
  assert.equal(v.body.verification, 'pending');
  const card = await call('GET', `/api/users/${bia.id}`, { token: leo.token }); // bloqueio removido; compatível
  assert.equal(card.body.verified, false);
  const del = await call('DELETE', `/api/me/photos/${up.json().id}`, { token: bia.token });
  assert.equal(del.body.photos.length, 0);
});

test('LGPD: exportação, desativação oculta perfil, exclusão apaga dados', async () => {
  const ex = await call('GET', '/api/me/export', { token: bia.token });
  assert.equal(ex.status, 200);
  assert.ok(ex.body.account && Array.isArray(ex.body.messages_sent));
  await call('POST', '/api/me/deactivate', { token: leo.token });
  assert.ok(!(await call('GET', '/api/discover', { token: bia.token })).body.profiles.some(p => p.id === leo.id));
  assert.equal((await call('GET', '/api/discover', { token: leo.token })).status, 403);
  await call('POST', '/api/me/reactivate', { token: leo.token });
  assert.equal((await call('DELETE', '/api/me', { token: bia.token, body: { password: 'errada123456' } })).status, 401);
  assert.equal((await call('DELETE', '/api/me', { token: bia.token, body: { password: PW } })).status, 200);
  const { rows } = await pool.query('SELECT (SELECT count(*) FROM users WHERE id = $1)::int u, (SELECT count(*) FROM messages WHERE sender_id = $1)::int m, (SELECT count(*) FROM reports WHERE reporter_id IS NULL)::int r', [bia.id]);
  assert.deepEqual(rows[0], { u: 0, m: 0, r: 1 });
});

test('rate limit no login', async () => {
  let last;
  for (let i = 0; i < 12; i++) last = await call('POST', '/api/auth/login', { ip: '10.9.9.9', body: { email: 'x@teste.elo', password: 'qualquer123' } });
  assert.equal(last.status, 429);
});
