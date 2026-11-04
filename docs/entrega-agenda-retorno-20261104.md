# Agenda por acesso e retorno de relatório — candidata de testes

Base: d2898ac3783406a9e3d1496953dd8cf1c8e9eaee, PR #2 em rascunho.

## Comportamento

- No domínio de testes com o projeto de testes selecionado, Agenda Operacional
  abre uma tela dedicada às consultas existentes por acesso. Não chama a agenda
  legada ao entrar e não recorre a ela se a consulta protegida falhar.
- Data, unidade e resultados da consulta são preservados ao voltar ao início e
  reabrir. Troca de conta continua limpando os resultados e fotos.
- A gestão anterior permanece em um botão explícito. Esta mudança NÃO fecha os
  acessos legados nem conclui a segregação de todos os fluxos do aplicativo.
- O Voltar do relatório completo retorna ao histórico, painel administrativo ou
  agenda que o abriu, preservando filtros e posição. Relatório gerado de um
  formulário salvo retorna ao histórico para não reabrir a mesma vistoria como nova.
- Uma mudança de sessão invalida o retorno. A navegação usa as telas existentes;
  não modifica o histórico do navegador ou o botão Voltar do Android.
- Outros domínios/projetos mantêm a entrada anterior da agenda.

## Validação automatizada

- `node tests/report-navigation.test.cjs`
- `node tests/field-report-ui.test.cjs`
- `node tests/field-agenda-api.test.cjs`
- `node tests/field-report-api.test.cjs`

Os testes usam dados sintéticos. Não comprovam login HTTP, autorização de contas
reais, funcionamento no celular ou publicação do artefato.

## Pendências da primeira entrega operacional

Continuam necessários os testes autenticados dos perfis gestor, técnico RS,
técnico SC e parceiro, a adoção das operações de escrita autorizadas e o
fechamento coordenado dos caminhos antigos. Seguir
`docs/sequencia-liberacao-oficial.md` antes de qualquer implantação oficial.
Nenhuma migração ou mudança no banco faz parte desta candidata.
