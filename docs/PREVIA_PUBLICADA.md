# Prévia do App Elo em produção (somente demonstração)

- Endereço: https://elo.hzsys.tech/
- Servidor: VPS srv2085016, contêiner isolado `app-elo-preview` na rede `coolify`.
- Runtime: Flutter Web compilado em `/opt/app-elo/app/build/web`, servido por nginx, roteamento HTTPS Traefik com certificado Let's Encrypt.
- Deploy: `cd /opt/app-elo && docker compose -f docker-compose.preview.yml up -d`.
- Teste realizado: GET / HTTP 200 e SSL verificado; GET /main.dart.js HTTP 200; /healthz HTTP 200; navegador Chromium em viewport mobile 390x844 carregou e botão 'Começar' abriu tela Boas-vindas sem erros JS.
- Capturas do browser: `artifacts/elo-preview-mobile.png` e `artifacts/elo-onboarding-browser.png`.
- URL da captura: https://elo.hzsys.tech/preview-mobile.png.

**Importante**: somente interface demonstrativa. Autenticação real, APIs, banco, match recíproco, chat e mecanismos de segurança ainda não estão implementados. Não usar dados reais, não publicar na loja.
