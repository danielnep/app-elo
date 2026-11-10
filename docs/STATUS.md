# Acompanhamento | App Elo

- [x] **Projeto & Especificação:** Diretório isolado `/opt/app-elo`, PRD, Paleta Trans refinada (+15% azul sem escurecer) e 10 telas especificadas.
- [x] **Banco de Dados Persistente:** Instância PostgreSQL isolada (`app-elo-db`), 11 tabelas com integridade referencial, restrições e índices.
- [x] **Backend & API REST:** Fastify (`app-elo-api`) rodando em container isolado na rede `coolify`, servido publicamente via proxy reverso em `https://elo.hzsys.tech/api/`.
- [x] **Etapa 01 - Abertura (Splash):** Sessão checada via `/api/me`, design dark premium `#101319` com gradientes da bandeira trans e logotipo de corações entrelaçados.
- [x] **Etapa 02 - Boas-vindas (Onboarding):** Tela acolhedora com indicadores, mensagem inclusiva, botões 'Começar' e 'Já tenho uma conta'.
- [x] **Etapa 03 - Cadastro & Autenticação:** Validação server-side estrita de +18 anos (`birth_date <= CURRENT_DATE - 18 years`), aceitação obrigatória de termos LGPD, hash scrypt OWASP e rotação de tokens.
- [x] **Etapa 04 - Identidade & Pronomes:** Homem trans, Mulher trans, Homem cis, Mulher cis autodeclarados, pronomes opcionais, independentes de orientação ou preferências afetivas.
- [x] **Etapa 05 - Filtros & Preferências:** Seleção múltipla e independente de gêneros buscados, idade 18+, distância aproximada (sem expor GPS exato) e interesses.
- [x] **Etapa 06 - Descoberta:** Feed compatível mútuo, sem mostrar o próprio usuário ou bloqueados, cartões acessíveis com ações de passar e curtir.
- [x] **Etapa 07 - Novo Match:** Curtida recíproca atômica em transação SQL; tela festiva com celebração mútua e botões para iniciar chat ou continuar descobrindo.
- [x] **Etapa 08 - Conversas:** Chat privado persistente restrito exclusivamente a matches ativos e não bloqueados.
- [x] **Etapa 09 - Perfil Completo:** Visualização, edição de bio, interesses, mídias assinadas temporariamente via HMAC contra exposição indevida.
- [x] **Etapa 10 - Segurança, Privacidade & LGPD:** Bloqueio mútuo, denúncia sigilosa com trilha em `audit_log`, solicitação legítima de verificação, exportação de dados (`GET /api/me/export`) e exclusão definitiva de conta (`DELETE /api/me`).
- [x] **QA & Testes Automatizados:**
  - Backend: 10/10 testes de integração passando via `node --test test/api.test.js`.
  - Flutter: `flutter analyze` sem nenhum issue (zero warnings/errors).
  - Flutter Widget Test: `test/widget_test.dart` aprovado.
  - Snapshots Goldens: 10 telas capturadas em 390×844 em `app/test/goldens/elo_tela_01.png` a `elo_tela_10.png`.
  - Playwright Headless Chromium: navegação validada em viewport mobile 390×844 (`HTTP 200`).
- [x] **Preview Público Navegável:** Ativo em `https://elo.hzsys.tech/` com certificado SSL Let's Encrypt.
- [ ] **Android Build (APK / AAB):** Toolchain Android SDK / CMake na VPS para gerar binários finais de distribuição (somente para homologação prévia, sem publicação não autorizada em loja).

*Última atualização: 10/11/2026 via May Maestro (Antigravity).*
