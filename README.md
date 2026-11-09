# App Elo

Aplicativo mobile de encontros inclusivo, projeto independente da Horizon. Paleta trans: rosa, azul bebê (#84CFFF), branco e grafite.

## Estrutura
- `app/`: Flutter Android, 10 telas e interações de demonstração.
- `docs/PRD.md`: requisitos de produto e segurança.
- `docs/telas/01-10`: instruções detalhadas sequenciais para Antigravity.
- `docs/PALETA.md`: tokens e regras de design.
- `assets/elo-logo.svg`: logotipo vetorial inicial.
- `docs/STATUS.md`: acompanhamento auditável.

## Estado
App Flutter inicial com fluxo navegável e estado local, **não é ainda produção**. Contas reais, banco, match persistente, chat servidor, denúncias, verificação legítima e LGPD operacional precisam ser implementados. Não usar dados reais no modo demonstração. Não publicar em loja.

## Testes
`flutter analyze` e `flutter test` na pasta `app`, via SDK em `/opt/horizon-mobile-toolchain/flutter/bin/flutter`.
