# Acompanhamento | App Elo
- [x] Projeto criado em /opt/app-elo, escopo, paleta e 10 instruções de tela.
- [x] Antigravity autenticado pelo perfil existente e acionado com modelo alternativo GPT-OSS 120B. Gerou scaffold Flutter; relatório inicial não equivalia a tela pronta.
- [x] UI demonstrativa local com navegação entre as 10 telas (implementada diretamente na VPS).
- [x] Widget test: abertura → onboarding.
- [x] Análise estática Flutter sem problemas, antes dos últimos ajustes visuais.
- [x] Capturas reais das 10 telas em app/test/goldens/elo_tela_01.png a elo_tela_10.png; teste de capturas passou em 390×844.
- [ ] Autenticação real, recuperação de senha, verificação +18 no servidor, consentimento LGPD.
- [ ] Banco de dados, APIs, fotos/autorização, matching mútuo persistente, chat real.
- [ ] Moderação, bloquear/denunciar/verificação de perfil reais.
- [ ] QA independente em múltiplas resoluções e dispositivo Android.
- [ ] APK/AAB release. Tentativa inicial de APK debug bloqueada por instalação incompleta de CMake Android SDK 3.22.1; corrigir toolchain antes de reexecutar.
- [ ] Preview público e publicação em loja (somente após homologação).

**Atenção:** UI é funcional em modo DEMONSTRAÇÃO LOCAL e NÃO deve receber dados reais. Não confundir capturas renderizadas com teste completo de backend ou validação de produção. Em 09/11/2026 a base visual foi implementada; as 10 etapas de produto ainda NÃO estão concluídas.
