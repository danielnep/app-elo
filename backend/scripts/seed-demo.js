import { pool, q, tx } from '../src/db.js';
import { hashPassword } from '../src/security.js';

async function seed() {
  console.log('[Seed Demo] Populando dados demonstrativos...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Limpar seeds anteriores se houver
    await client.query("DELETE FROM users WHERE is_demo = true");

    const demoUsers = [
      {
        display_name: 'Luna Vieira',
        email: 'demo.luna@elo.local',
        password: 'EloDemoPass2026!',
        birth_date: '1998-05-14', // 28 anos
        identity: 'mulher_trans',
        pronouns: 'ela_dela',
        city_code: 'sao_paulo',
        bio: 'Arquiteta, apaixonada por café especial, livros e caminhadas pela Paulista.',
        interests: ['cafe', 'arte', 'filmes', 'livros', 'trilhas'],
        seeking: ['homem_cis', 'homem_trans', 'mulher_trans'],
        verification: 'verified'
      },
      {
        display_name: 'Gael Silva',
        email: 'demo.gael@elo.local',
        password: 'EloDemoPass2026!',
        birth_date: '1996-09-22', // 30 anos
        identity: 'homem_trans',
        pronouns: 'ele_dele',
        city_code: 'sao_paulo',
        bio: 'Músico e designer. Curto conversas profundas, vinil e gastronomia.',
        interests: ['musica', 'culinaria', 'arte', 'fotografia'],
        seeking: ['mulher_trans', 'mulher_cis', 'homem_trans'],
        verification: 'verified'
      },
      {
        display_name: 'Alexandre Souza',
        email: 'demo.alex@elo.local',
        password: 'EloDemoPass2026!',
        birth_date: '1995-02-11', // 31 anos
        identity: 'homem_cis',
        pronouns: 'ele_dele',
        city_code: 'sao_paulo',
        bio: 'Desenvolvedor, tutor de dois gatos e amante de cinema alternativo. Aberto a conexões verdadeiras.',
        interests: ['tecnologia', 'pets', 'teatro', 'games'],
        seeking: ['mulher_trans', 'homem_trans'],
        verification: 'none'
      },
      {
        display_name: 'Maya Carvalho',
        email: 'demo.maya@elo.local',
        password: 'EloDemoPass2026!',
        birth_date: '2001-11-03', // 25 anos
        identity: 'mulher_cis',
        pronouns: 'ela_dela',
        city_code: 'sao_paulo',
        bio: 'Psicóloga, fã de museus, feiras orgânicas e MPB. Respeito e afeto.',
        interests: ['bem_estar', 'musica', 'arte', 'natureza'],
        seeking: ['homem_trans', 'mulher_trans'],
        verification: 'verified'
      }
    ];

    const createdUsers = [];

    for (const u of demoUsers) {
      const pwdHash = await hashPassword(u.password);
      const resU = await client.query(
        `INSERT INTO users (email, password_hash, birth_date, is_demo, terms_accepted_at, terms_version, email_verified_at)
         VALUES ($1, $2, $3, true, now(), '2026-11-10', now())
         RETURNING id, email`,
        [u.email, pwdHash, u.birth_date]
      );
      const uid = resU.rows[0].id;

      await client.query(
        `INSERT INTO profiles (user_id, display_name, bio, identity, pronouns, city_code, interests, verification, visible, onboarding_step)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, 2)`,
        [uid, u.display_name, u.bio, u.identity, u.pronouns, u.city_code, u.interests, u.verification]
      );

      await client.query(
        `INSERT INTO preferences (user_id, seeking, age_min, age_max, max_distance_km)
         VALUES ($1, $2, 18, 55, 50)`,
        [uid, u.seeking]
      );

      createdUsers.push({ id: uid, ...u });
    }

    // Criar um match demonstrativo recíproco entre Luna (0) e Gael (1)
    const uLuna = createdUsers[0];
    const uGael = createdUsers[1];

    await client.query(
      `INSERT INTO swipes (from_user, to_user, kind) VALUES ($1, $2, 'like'), ($2, $1, 'like')`,
      [uLuna.id, uGael.id]
    );

    const [u1, u2] = uLuna.id < uGael.id ? [uLuna.id, uGael.id] : [uGael.id, uLuna.id];
    const matchRes = await client.query(
      `INSERT INTO matches (user_a, user_b, active)
       VALUES ($1, $2, true)
       RETURNING id`,
      [u1, u2]
    );
    const matchId = matchRes.rows[0].id;

    // Mensagens demonstrativas
    await client.query(
      `INSERT INTO messages (match_id, sender_id, body, created_at)
       VALUES ($1, $2, 'Oi Luna! Adorei suas fotos e sua bio sobre cafés ☕', now() - interval '20 minutes'),
              ($1, $3, 'Oi Gael! Tudo bem? Qual seu café preferido por aqui? 😊', now() - interval '15 minutes'),
              ($1, $2, 'Tem um lugar incrível perto da Fradique, podemos marcar!', now() - interval '5 minutes')`,
      [matchId, uGael.id, uLuna.id]
    );

    await client.query('COMMIT');
    console.log('[Seed Demo] Sucesso! 4 usuários de demonstração criados, 1 match mútuo e 3 mensagens populados.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Seed Demo] Erro:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
