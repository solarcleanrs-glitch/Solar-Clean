# Agenda de testes: diagnóstico e proposta

Projeto exclusivo: Solar Clean testes crm / zzphucuiqhzrilrddxnf.

## Resultado recebido

O usuário retornou `{"rls":null,"colunas":null,"politicas":null}` para a consulta
do nome exato public.agenda_eventos, usado pelo código atual. Não há essa relação
nos metadados consultados. As consultas anteriores não incluíam esse nome e,
portanto, não eram evidência de ausência da agenda.

## Alteração preparada para autorização

Arquivo: ../supabase/migrations/20261030_agenda_eventos_STAGING_NOT_APPLIED.sql.

- Criar agenda_eventos vazia, com campos já enviados pelo código: cliente, contato,
  endereço, placas, unidade, data/horário, equipe, status, observações, valores e
  referência do evento Google. Acrescentar maps_url para preservar o link fornecido.
- Vincular opcionalmente ao escopo de cliente/unidade/parceiro. FK composta exige
  que a unidade da agenda corresponda à unidade do escopo. Sem parceiro duplicado
  no evento: a origem vem do vínculo. NULL é não classificado, não Particular.
- Permitir NULL no vínculo para não quebrar a versão de testes anterior. A versão
  nova deverá exigir origem explícita em novos eventos; legado será classificado
  manualmente. Não atribuir parceiro, unidade ou preço por inferência.
- Impedir troca de escopo já classificado pelo UPDATE/UPSERT comum.
- Criar revisão e timestamps controlados por gatilho. O número de revisão por si só
  não evita sobrescrita: a nova versão precisará PATCH com revisão-base e confirmação.
- RLS e grants permitem SELECT/INSERT/UPDATE somente ao gestor ativo. Valores e
  observações ficam inacessíveis a técnicos/parceiros, até criar projeções específicas.
- Sem DELETE na API. Campo de arquivamento reversível preparado. O botão de exclusão
  da versão antiga não é compatível com esta restrição; deve ser adaptado na nova
  versão ANTES de testar operações de exclusão, especialmente com evento Google.
- Cadastrar apenas nomes YES/Elysia, caso ainda não existam com esses nomes exatos.
  Não incluir tabelas de preços, serviços, clientes, contatos ou eventos Google.

## Escopo e estado

SQL aplicado manualmente pelo usuário, que reportou Success e enviou verificação:
agenda_eventos com RLS=true; políticas SELECT/INSERT/UPDATE exigindo sc_is_manager;
YES e Elysia ativas, com IDs próprios. Nenhuma execução de escrita pelo agente.
Não requer publicação nem qualquer alteração em produção. Não executar duas vezes;
a segunda execução deve falhar e exigir conferência em vez de sobrescrever esquema.
Não houve validação em PostgreSQL local ou teste E2E real desta migração.

## Integração preparada localmente depois da aplicação do SQL

1. Implementado: origem por IDs do cadastro, exigida nos novos eventos da interface.
   Filtro por Particular, parceiro ou não informado; nomes não são chaves.
2. Correção local implementada: preservar finanças ao editar cliente/horário.
3. Implementado: vínculo salvo antes do evento, propagado à vistoria. Serviços
   classificados mantêm cliente/unidade/origem bloqueados na edição comum.
   Formulário reutilizado do histórico não sobrescreve a origem do agendamento.
   Limpar/abrir outra vistoria remove a referência anterior de origem da agenda.
4. Correção local implementada: conferir uma linha de resposta com ID correspondente
   antes de mostrar "sincronizado". Offline fica pendente. Confirmação atrasada não
   conclui edição mais recente, inclusive se o relógio repetir o mesmo milissegundo.
5. Manutenção de edições locais pendentes e preservação por ausência remota
   implementadas localmente. Paginação lê até página vazia, sem presumir o limite
   de linhas do projeto; resposta repetida interrompe com preservação local.
6. Implementado: PATCH condicionado à revisão para registros confirmados. Criação
   usa POST sem UPSERT; reenvio consulta UUID e confirma conteúdo idêntico, ou acusa
   conflito. Sincronização geral reenvia a fila local pendente da agenda de testes.
7. Implementado no código de testes: Arquivar no app usa PATCH com revisão e mantém
   o registro. Confirmação informa que evento Google continuará ativo. Fluxo retorna
   antes de qualquer requisição de DELETE Google. Nenhum teste com evento real.
8. Verificar com JWT de gestor e conta fictícia sem acesso, incluindo dados financeiros.

Revisão estática da proposta não substitui execução real em projeto de testes,
após autorização específica, nem aprova implantação operacional da agenda.

## Verificação de código local

Testes com API simulada executam as funções reais de salvar/ler agenda. Cobrem
offline, resposta vazia ou com ID errado, queda durante envio, confirmação válida,
preservação de finanças, edição local pendente, evento ausente da resposta e
confirmação atrasada. O payload gerado foi comparado às colunas da proposta SQL.
Não houve conexão com Supabase pelo agente, evento Google criado/excluído ou publicação.
Testes adicionais cobrem origem por UUID, filtros, bloqueio de edição de contexto,
herança para a vistoria, leitura de metadados divergentes, PATCH por revisão,
conflito, retomada de criação idêntica, paginação, arquivamento e reenvio da fila.

O vínculo do ID Google também passa pela gravação com revisão na nova versão,
mantendo a revisão local atualizada. Ambiguidade de rede na criação do próprio
evento Google e importação histórica continuam fora desta entrega.

## Limites antes de liberar uso

- Alterações do aplicativo estão apenas no checkout local da branch de testes.
  Não houve push, publicação ou atualização do site hospedado nesta etapa.
- Testes usam DOM simplificado/API simulada; não houve QA visual ou E2E real da
  nova versão. Não declarar aprovação operacional da agenda com base nesses testes.
- Validar também agenda e novos cadastros usando outra sessão com JWT real.
- Técnicos/parceiros continuam bloqueados. Não liberar esses perfis sem projeções
  de dados e isolamento de cache por conta, além das políticas por unidade/parceiro.
