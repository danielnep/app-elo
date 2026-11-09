# PRD | App Elo v0.1
## Objetivo
App de relacionamentos mobile-first REAL, acolhedor, elegante e seguro, para adultos trans e pessoas cis/trans compatíveis com suas preferências, sem excluir usuários por aparência e sem transformar identidade em fetiche.

## Público e regras
- +18; usuário informa data de nascimento e aceita termos/privacidade.
- Identidade do usuário: homem trans, mulher trans, homem cis, mulher cis. Pronomes opcionais: ele/dele, ela/dela, elu/delu, outro personalizável, ou não informar.
- Preferência de descoberta é MÚLTIPLA e INDEPENDENTE: homens cis, homens trans, mulheres cis, mulheres trans. Não inferir orientação ou interesse pela identidade informada.
- Filtrar faixa etária adulta, distância aproximada (padrão 50 km), interesses; não mostrar coordenadas.
- Fotos com consentimento; perfil editável, visibilidade controlável, capacidade de desativar/excluir conta.
- Curtida recíproca cria match; chat de texto habilitado somente após match não bloqueado; desfazer like opcional.
- Segurança: autenticação segura, e-mail verificado, bloqueio e denúncia com trilha auditável administrativa; ocultar informações sensíveis. Selo verificado somente após verificação legítima.
- Contas e fotos demonstrativas em seed dev separada, explicitamente "DEMONSTRAÇÃO".

## Dez telas de referência, ordem obrigatória
01 Abertura/splash; 02 Boas-vindas/onboarding; 03 Cadastro/entrar/recuperar; 04 Identidade e pronomes; 05 Filtros e preferências; 06 Descoberta; 07 Novo match; 08 Conversas; 09 Perfil completo; 10 Segurança e privacidade.

## Integrações e dados
Criar backend REST com contas, perfis, preferências, likes, matches, mensagens, denúncias, bloqueios, mídia, controles de privacidade. Persistência em banco isolado, migrações, testes, configuração .env.example SEM segredos. Documentar modelo e endpoints com OpenAPI. Auth com hash de senha robusto, tokens curtos, rate limit. Google login só habilitar depois de configurar credenciais; botão indisponível deve ter estado explicativo, nunca falsa autenticação.

## Qualidade e aceite
Cada botão/controle navegável e ação persistente; estados carregando/vazio/erro, login inválido, permissão negada, acessibilidade, responsive 320/360/390/430 px; verificação em Android real ou emulador e Web se aplicável. Registrar prints reais das 10 telas e testes funcional/backend. QA independente obrigatório. Não afirmar "pronto" sem evidência. Entregar no final build Android .aab assinável, APK debug de teste, URL de preview funcionando, guia de instalação e checklist de loja, mas NÃO publicar automaticamente.

## Entregáveis por etapa
Código + teste + captura real + status.md + commit. Se agent CLI indisponível, registrar blocker e continuar preparação local sem fingir execução.
