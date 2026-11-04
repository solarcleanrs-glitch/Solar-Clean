# Agenda por acesso e retorno de relatório — candidata de testes

Base: d2898ac3783406a9e3d1496953dd8cf1c8e9eaee, PR #2 em rascunho.

## Comportamento

- No domínio de testes com o projeto de testes selecionado, Agenda Operacional
  abre uma tela dedicada às consultas existentes por acesso. Não chama a agenda
  legada ao entrar e não recorre a ela se a consulta protegida falhar.
- Data, unidade e resultados da consulta são preservados ao voltar ao início e
  reabrir. Troca de conta continua limpando os resultados e fotos.
- A gestão anterior permanece em um botão explícito, que consulta a permissão
  de gestor no servidor antes de chamar o fluxo antigo. Recusa, erro ou mudança
  de sessão não abrem a gestão. A verificação usa a função existente
  `sc_pode_registrar_contato_cliente`, que exige gestor ativo e `crm_usuarios`.
  Esta mudança NÃO fecha os
  acessos legados nem conclui a segregação de todos os fluxos do aplicativo.
- O Voltar do relatório completo retorna ao histórico, painel administrativo ou
  agenda que o abriu, preservando filtros e posição. Relatório gerado de um
  formulário salvo retorna ao histórico para não reabrir a mesma vistoria como nova.
- Uma mudança de sessão invalida o retorno. A navegação usa as telas existentes;
  não modifica o histórico do navegador ou o botão Voltar do Android.
- O domínio de testes e seus previews Cloudflare aceitam a nova entrada.
  Outros domínios/projetos mantêm a entrada anterior da agenda. Os controles
  de rascunhos de outros módulos continuam sujeitos aos seus próprios limites
  de domínio; este ajuste não amplia a ativação desses módulos.

## Validação automatizada

- `node tests/report-navigation.test.cjs`
- `node tests/field-report-ui.test.cjs`
- `node tests/field-agenda-api.test.cjs`
- `node tests/field-report-api.test.cjs`
- `NODE_PATH=./tests/postgres/node_modules node tests/imported-contact-db.integration.cjs`
  confere que a função reutilizada pelo botão exige gestor ativo e cadastro autorizado.
- Navegador: `npm ci --prefix tests/browser --ignore-scripts`,
  `node tests/browser/node_modules/playwright/cli.js install chromium`,
  `NODE_PATH=./tests/browser/node_modules node tests/field-navigation.browser.cjs`.
  O workflow também executa esse ensaio. Requisições são atendidas com arquivos
  locais e o ambiente sintético bloqueia acesso a dados reais.

Os testes usam dados sintéticos. Não comprovam login HTTP, autorização de contas
reais, funcionamento no celular ou publicação do artefato.

Em 04/11/2026, o ensaio local em Chromium passou com viewport 412 × 915 no
domínio principal de testes e em um domínio de preview sintético. Conferiu
entrada protegida, recusa offline, unidade preservada e retorno do histórico,
administração, agenda e formulário salvo. Não substitui teste num aparelho real.

## Pendências da primeira entrega operacional

### Conferência do banco de testes em 04/11/2026

Consultas em transação somente leitura com ROLLBACK, exclusivamente no projeto
`zzphucuiqhzrilrddxnf`, confirmaram a função de permissão existente, sem EXECUTE
para `anon` e com EXECUTE para `authenticated`. Sua definição exige UUID
autenticado, gestor ativo em `sc_acessos` e vínculo em `crm_usuarios`.
RLS está ativo em `agenda_eventos` e `vistorias`; as políticas consultadas da
agenda exigem gestor e as vistorias têm políticas restritivas de gestor.
Isso não é uma auditoria de todos os caminhos do aplicativo.

O cadastro de acesso contém somente um gestor ativo. Não há perfis de técnico
RS, técnico SC ou parceiro cadastrados nessa tabela para concluir os ensaios
HTTP reais. Não foram criadas contas, alteradas permissões ou lidos dados de
clientes para essa conferência.

Continuam necessários os testes autenticados dos perfis gestor, técnico RS,
técnico SC e parceiro, a adoção das operações de escrita autorizadas e o
fechamento coordenado dos caminhos antigos. Seguir
`docs/sequencia-liberacao-oficial.md` antes de qualquer implantação oficial.
Nenhuma migração ou mudança no banco faz parte desta candidata.
