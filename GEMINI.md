# App Elo | Projeto Antigravity independente

**Nome oficial do projeto: App Elo.** Caminho /opt/app-elo. App de encontros para adultos, centrado em homens trans e mulheres trans que buscam conexões com homens cis, homens trans, mulheres cis ou mulheres trans, conforme a preferência individual.

Prioridade obrigatória: implementar um aplicativo REAL, persistente e navegável, não uma imagem/mockup estático. Usar Flutter para Android com backend/API isolados na VPS, ou documentar justificativa técnica se adaptar para outra stack. Publicação em loja depende de aprovação futura, mas preview deve ser acessível. Trabalhar por ETAPAS SEQUENCIAIS 01-10, testando cada uma antes de iniciar a próxima e mantendo registro de progresso.

## Identidade visual EXCLUSIVA DO APP ELO
A regra global da Horizon que fixa o azul #1F98FF NÃO se aplica à UI deste projeto, por decisão específica do proprietário. Nenhuma configuração de outros projetos deve ser alterada.
Cores: azul bebê vibrante #84CFFF (mais intenso ~15%, com matiz levemente deslocada ao azul e luminosidade preservada), rosa #F6A1CD, rosa vivo #FF84BE, branco #FFFFFF, fundo #101319, superfície #1B202A, elevação #262C37, texto secundário #C7D0DA.
Use azul e rosa como cores identitárias, em gradientes discretos e botões/chips refinados; tema dark PREMIUM predominante; fontes Inter/Manrope; bordas arredondadas 16-24; contraste acessível e teclado mobile correto. Evitar excesso de neon, gradiente e poluição visual. Logotipo ELO: duplo coração/elo entrelaçado, lado rosa e lado azul.

## Segurança, diversidade e privacidade
Acesso estritamente +18; identidade de gênero e gêneros buscados são campos independentes, nunca inferir intenção afetiva pela identidade. Permitir seleção múltipla de interesses de encontro, pronomes opcionais e edição de identidade com respeito. Orientações de consentimento e LGPD, minimização de dados sensíveis, controles de visibilidade, exclusão de conta e fotos, denúncia, bloqueio, privacidade de posição (apenas distância aproximada). Fotos e selos de verificação SÓ para perfis realmente verificados, não mentir verificação; dados de demo claramente isolados do ambiente real.
Não permitir conversas sem match mútuo. Não oferecer recursos falsos/inertes.

## Fronteiras operacionais
- Não modificar, reiniciar, parar ou substituir agentes, serviços, containers, bancos, sites e aplicações de outros projetos.
- Manter isolamento absoluto do app (diretório, portas, credenciais, recursos, deploy e banco).
- Consultar /opt/antigravity-workspace/GEMINI.md e instruções dos agentes existentes para normas gerais de QA/backup, exceto a paleta global substituída pela identidade exclusiva do Elo.
- Delegação sugerida: may-maestro coordena, mobile-engineer e mobile-ui-specialist desenham e codificam telas, backend-database executa API/DB, qa-guardian faz QA separado, devops-integration estrutura serviço isolado.
- Executar as 10 etapas /opt/app-elo/docs/telas/01-10 em sequência; etapa concluída exige print REAL da interface, teste dos fluxos, registro em docs/STATUS.md, commits pequenos e sem regredir telas anteriores.
- Nada de publicação na Google Play até avaliação final da build .aab e políticas.
- Não expor chaves, tokens, dados pessoais reais ou e-mails em código/repos/logs. Nunca armazenar senha em texto puro.
