-- App Elo | Schema Relacional Completo
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Usuários
CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             VARCHAR(255) UNIQUE NOT NULL,
  password_hash     TEXT NOT NULL,
  birth_date        DATE NOT NULL,
  terms_accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  terms_version     VARCHAR(32) NOT NULL DEFAULT '2026-11-10',
  email_verified_at TIMESTAMPTZ,
  is_demo           BOOLEAN NOT NULL DEFAULT false,
  status            VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactivated', 'suspended')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_adult CHECK (birth_date <= (CURRENT_DATE - INTERVAL '18 years'))
);

-- 2. Perfis
CREATE TABLE IF NOT EXISTS profiles (
  user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name      VARCHAR(100) NOT NULL,
  bio               TEXT DEFAULT '',
  identity          VARCHAR(50),
  identity_public   BOOLEAN NOT NULL DEFAULT true,
  pronouns          VARCHAR(50),
  pronouns_custom   VARCHAR(50),
  visible           BOOLEAN NOT NULL DEFAULT true,
  show_distance     BOOLEAN NOT NULL DEFAULT true,
  city_code         VARCHAR(50) DEFAULT 'sao_paulo',
  lat               NUMERIC(9,6) DEFAULT -23.5505,
  lng               NUMERIC(9,6) DEFAULT -46.6333,
  verification      VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (verification IN ('none', 'pending', 'verified', 'rejected')),
  onboarding_step   INTEGER NOT NULL DEFAULT 0,
  interests         TEXT[] NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Preferências (vazio por padrão até o usuário escolher)
CREATE TABLE IF NOT EXISTS preferences (
  user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  seeking           TEXT[] NOT NULL DEFAULT '{}',
  age_min           INTEGER NOT NULL DEFAULT 18 CHECK (age_min >= 18),
  age_max           INTEGER NOT NULL DEFAULT 60 CHECK (age_max >= age_min),
  max_distance_km   INTEGER NOT NULL DEFAULT 50 CHECK (max_distance_km >= 1 AND max_distance_km <= 500),
  interests         TEXT[] NOT NULL DEFAULT '{}',
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Sessões
CREATE TABLE IF NOT EXISTS sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_hash         VARCHAR(64) UNIQUE NOT NULL,
  refresh_hash        VARCHAR(64) UNIQUE NOT NULL,
  access_expires_at   TIMESTAMPTZ NOT NULL,
  refresh_expires_at  TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Tokens de Ação (Verificação e Reset)
CREATE TABLE IF NOT EXISTS action_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose       VARCHAR(32) NOT NULL,
  token_hash    VARCHAR(64) UNIQUE NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  used_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Fotos com Consentimento
CREATE TABLE IF NOT EXISTS photos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name     VARCHAR(255) NOT NULL,
  mime          VARCHAR(64) NOT NULL,
  position      INTEGER NOT NULL DEFAULT 0,
  consent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Swipes
CREATE TABLE IF NOT EXISTS swipes (
  from_user     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          VARCHAR(10) NOT NULL CHECK (kind IN ('like', 'pass')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (from_user, to_user),
  CONSTRAINT chk_no_self_swipe CHECK (from_user <> to_user)
);

-- 8. Matches
CREATE TABLE IF NOT EXISTS matches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at      TIMESTAMPTZ,
  CONSTRAINT uq_matches_pair UNIQUE (user_a, user_b),
  CONSTRAINT chk_user_order CHECK (user_a < user_b)
);

-- 9. Mensagens
CREATE TABLE IF NOT EXISTS messages (
  id            BIGSERIAL PRIMARY KEY,
  match_id      UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body          TEXT NOT NULL,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Bloqueios e Denúncias
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT chk_no_self_block CHECK (blocker_id <> blocked_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  reported_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason        VARCHAR(100) NOT NULL,
  details       TEXT DEFAULT '',
  status        VARCHAR(20) NOT NULL DEFAULT 'aberta',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Auditoria e Outbox de E-mails
CREATE TABLE IF NOT EXISTS audit_log (
  id            SERIAL PRIMARY KEY,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  action        VARCHAR(100) NOT NULL,
  target_id     VARCHAR(100),
  meta          JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mail_outbox (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  kind          VARCHAR(50) NOT NULL,
  to_email      VARCHAR(255) NOT NULL,
  payload       JSONB NOT NULL,
  sent_at       TIMESTAMPTZ,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_swipes_target ON swipes(to_user);
CREATE INDEX IF NOT EXISTS idx_matches_pair ON matches(user_a, user_b);
CREATE INDEX IF NOT EXISTS idx_messages_match ON messages(match_id, id);
CREATE INDEX IF NOT EXISTS idx_blocks_pair ON blocks(blocker_id, blocked_id);
