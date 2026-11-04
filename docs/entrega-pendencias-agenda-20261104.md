# Pendências e reenvio separado da agenda — testes

Base: b4e520e1ea6e486404900de7a3ae9fa0ee0a7610, candidata do PR #3.

## Problema e comportamento

O resumo local contava apenas vistorias, embora a agenda também tivesse uma
fila offline. A sincronização completa envia vistorias antes da agenda: um
conflito de vistoria pode impedir que o usuário chegue ao reenvio da agenda.

No projeto de testes, Dados da empresa oferece “Sincronizar somente agenda”.
Essa ação usa a fila existente, exige conexão e autenticação e não chama upload
de vistoria, download geral ou resolução de conflito. O resumo local separa as
quantidades de vistorias e agendamentos pendentes. “Sem envios pendentes” descreve
somente essas duas filas locais; não atesta que todos os módulos estão atualizados.

A fila compartilha uma operação entre gatilhos simultâneos e relê a edição local
mais recente antes de enviar cada item. Uma queda de conexão que deixa um item
local não é contada como envio confirmado. Novas pendências surgidas durante o
lote continuam visíveis e exigem outro reenvio. Troca de sessão interrompe a fila.

## Limites

- Reenvio separado disponível apenas no projeto de testes. Não ativa usuários,
  altera permissões ou migra o banco.
- Não sincroniza Google Agenda, contatos do CRM, fotos isoladas ou fechamentos.
- Não resolve conflitos automaticamente e não apaga dados pendentes.
- O bloqueio de gatilhos é por aba; confirmações e revisões do servidor continuam
  necessárias para operações em outros aparelhos ou abas.
- A consulta de campo por acesso continua exigindo conexão; não há cache offline
  novo de dados de parceiros ou técnicos.

## Validação

- `node tests/agenda-sync.test.cjs`: concorrência, edição de item ainda na fila,
  queda de conexão, nova pendência durante lote e interrupção por troca de conta.
- `node tests/sync-agenda-only.test.cjs`: ação isolada, recusas, preservação das
  vistorias e resumo das duas filas.
- Ensaio Chromium existente, em viewport 412 × 915 e dados sintéticos, verifica
  duas pendências, tentativa offline sem mutação e limpeza do resumo na troca
  de conta. Não substitui teste autenticado em aparelho físico.
