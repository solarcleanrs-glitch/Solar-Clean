# Fechamentos e recebimentos — preparo para testes

## Estado

Prévia mensal e CSV da revisão 5 confirmados pelo usuário. O preparo desta etapa
é código e migração; **não instalado no Supabase e não conectado à interface**.
O site permanece na revisão 5. Não usar esta entrega para registrar pagamentos reais.
Nenhuma tabela de produção ou dado remoto foi alterado pelo agente.

## O que foi preparado

- Migração única em `supabase/migrations/20261030_fechamentos_STAGING_NOT_APPLIED.sql`.
  Três tabelas: fechamento, itens com foto dos valores conferidos, recebimentos.
  Snapshot guarda nome do parceiro e cliente/data agendada; não guarda telefone,
  notas internas, endereço, fotos ou assinatura.
- Criação por RPC em uma transação: confirma status Concluído, unidade, parceiro,
  mês da data agendada, revisão de cada serviço e valores efetivos do banco.
  Preços fornecidos no corpo da requisição não são usados. Limite de 500 serviços.
- Índice único por serviço em fechamento ativo. Cancelamento mantém histórico e
  libera os itens; um fechamento com recebimento não pode ser cancelado sem estorno.
  Estorno não foi implementado. Não há DELETE na API.
- Recebimento em centavos com ID de operação: saldo desconta valores anteriores
  já registrados na agenda. Permite pagamento parcial, impede valor excedente.
  Reenvio com ID e conteúdo iguais retorna o resultado existente; ID reaproveitado
  com outros parâmetros é recusado. Não cria registros de exemplo na instalação.
- Bloqueio da edição financeira, mês, status, arquivo e identidade do serviço fechado;
  bloqueio também na alteração do parceiro/unidade no escopo correspondente.
- Tabelas: somente SELECT para authenticated, com RLS exigindo gestor ativo.
  Escritas apenas pelas três RPCs, SECURITY DEFINER com search_path vazio,
  execução pública e anon revogada, gestor conferido no início da função.
  Helper de resultado não pode ser executado diretamente pela API.
- Adaptador `lib/settlement-api.cjs`: somente projeto de testes, payload explícito,
  revisão e IDs obrigatórios, valida confirmação e a equação dos totais.
- Journal `lib/settlement-journal.cjs`: operação pendente durável por conta/projeto,
  ID preservado após resposta ambígua e bloqueio obrigatório entre abas. Ainda não
  importado pelo app. Não salva tokens. A interface deverá obter a conta da sessão
  autenticada atual, fornecer Web Locks e renovar a sessão antes do envio.

## Limites que a interface deverá expor

Esta versão usa data **agendada**, não data de execução ou competência fiscal.
Não aplica tabelas comerciais YES/Elysia nem presume extras aprovados: cobra o
valor_cobrado expressamente registrado. Gastos extras continuam custos internos.
O recebimento anterior da agenda é congelado no fechamento. Os novos recebimentos
ficam no livro do fechamento e **não** fazem UPDATE em lote na agenda. Após instalar,
o relatório financeiro definitivo deverá ler esse livro para não duplicar ou omitir
recebimentos; a prévia atual continua baseada apenas na agenda e não substitui isso.

Não existe emissão de cobrança, envio ao parceiro, transação bancária, emissão fiscal
ou baixa real automática. Perfis técnico/parceiro seguem bloqueados.

## Validação executada

`npm ci --prefix tests/postgres --ignore-scripts --no-audit --no-fund`
`npm --prefix tests/postgres run test:ledger`
`for testfile in tests/*.test.cjs; do node "$testfile" || exit 1; done`

PGlite 0.5.13 executa PostgreSQL embutido com dados fictícios, a migração da agenda e
esta migração. Testa rollback de criação incompleta, revisão, parceiro divergente,
serviço repetido em fechamento ativo, reenvio, centavos, parcial/total, excesso,
mutação bloqueada, cancelamento e nova reserva, grants e RLS com papéis anon e
 authenticated. `auth.uid` e o teste de gestor usam fixtures locais. Não é conexão
com Supabase, JWT real ou validação de suas políticas instaladas.

A instância embutida serializa chamadas. Os locks/índices foram incluídos, mas
concorrência de conexões PostgreSQL independentes ainda exige ensaio no banco de
testes. Adaptador/journal têm testes de rede simulada, duas chamadas concorrentes,
armazenamento cheio/ilegível e tentativa de acessar outro projeto. Não é E2E de UI.

O workflow de homologação agora instala apenas a dependência de testes e executa
esta validação em cada push. A dependência não entra no pacote estático do app.

## Próximo passo que exige a sessão do usuário

1. Confirmar no painel o projeto **Solar Clean testes crm / zzphucuiqhzrilrddxnf**.
2. Rodar primeiro `supabase/diagnostics/inspecionar_fechamentos_somente_leitura.sql`.
   Se já existir qualquer uma das três tabelas, parar e comparar o esquema; não
   tentar adaptar às cegas. As tabelas não haviam sido consultadas nesta sessão.
3. Se ausentes, executar uma vez a migração completa. É transacional e falha em
   execução repetida. Não aplicar somente partes ou remover constraints para passar.
4. Executar novamente o diagnóstico. Esperado: três tabelas com RLS, três políticas
   SELECT para gestor, authenticated com apenas SELECT, anon sem acesso.
5. Conferir funções/grants e executar teste com JWT real do gestor e outro usuário
   sem acesso antes de habilitar botões de gravação na interface.
6. Só então integrar interface ao adaptador/journal e testar em duas abas/dispositivos:
   mesmo serviço em fechamentos diferentes, mesmo recebimento reenviado após falha,
   revisão alterada, total/parcial, cancelamento sem recebimento e bloqueio com ele.

Não há acesso SQL disponível ao agente nesta sessão. Por isso nenhuma migração foi
aplicada e os botões de gravação ainda não foram publicados. Não apagar ou alterar
vistorias antigas para executar os testes. Nenhuma ação pendente será iniciada
sozinha depois do encerramento deste trabalho.

## Atualização — instalação e integração da revisão 6

Usuário confirmou ausência das três tabelas, executou a migração e reportou Success.
Verificação retornou RLS ativo, anon sem acesso, authenticated apenas SELECT nas
três tabelas. Conferiu três políticas SELECT com sc_is_manager, funções de escrita
SECURITY DEFINER/anon negado/authenticated permitido e helper privado negado a ambos.
Essas verificações são resultados enviados pelo usuário, não conexão do agente.

Revisão 6 conecta a UI à API/journal por bundle estático reproduzível. Preparação
busca a agenda no servidor, confere origem, exclui itens já fechados, exige revisão
e bloqueia edição local pendente. Gravação exige confirmação e usa IDs estáveis.
A consulta exibe totais, valor anterior da agenda, novos recebimentos e saldo; lê
recebimentos por paginação independente. Há formulário explícito para data/forma/
valor, cancelamento com motivo sem recebimento e retomada manual de operação ambígua.
Mudança de conta/filtros limpa os dados em memória; não há cache persistente do
histórico financeiro. Journal persiste só a operação por conta. Nenhuma baixa da
agenda é realizada. Respostas SQL de rejeição confirmada liberam novo preparo;
resposta ambígua exige mesmo ID. Falha da consulta após gravação informa que a
gravação já foi confirmada. UI não iniciou qualquer operação no banco do usuário.

Testes simulados da UI executam o bundle e os handlers reais: preparar, confirmação
cancelada, commit com resposta perdida, retomada sem duplicação, recebimento parcial,
excesso e limpeza de filtros. Testes PostgreSQL continuam passando. Falta validação
visual/autenticada pelo gestor no site e concorrência com duas conexões reais.
Os parágrafos anteriores sobre estado não integrado descrevem o preparo anterior;
a instalação foi reportada agora e a revisão 6 é a primeira integração da interface.

## Validação do gestor e revisão 7

Gestor enviou telas confirmando fechamento de teste SC/YES de R$350, recebimento
parcial de R$100, quitação com mais R$250, dois registros no histórico, persistência
após recarregar e exclusão do serviço da preparação seguinte (um já fechado).
Não houve execução desses recebimentos pelo agente.

Revisão 7 acrescenta projeção somente de leitura na agenda: consulta vínculos ativos
por IDs visíveis, confere unidade/parceiro e soma recebimentos paginados do fechamento.
Mostra Quitado no fechamento com saldo zero; parcial/pendente mostram expressamente
o saldo do fechamento inteiro, sem atribuir recebimento a um serviço específico.
Não modifica pagamento_status/valor_recebido nem soma valores duas vezes. Cancelamento
sem vínculo ativo volta ao status original da agenda. Offline/erro não afirma quitação.
Dados ficam somente em memória, limpos por conta/filtros e respostas antigas descartadas.
Após gravar/cancelar/receber, atualiza os indicadores. Editor antigo é fechado quando
seu serviço é vinculado; Valores orienta a consultar o fechamento sem permitir edição
pela interface. O servidor continua sendo a proteção definitiva contra mutação.
Testes cobrem saldo inteiro/parcial, anterior já quitado, cancelamento, paginação,
resposta inválida/duplicada, falha de rede e troca de conta durante leitura.
Falta conferir visualmente na sessão real do gestor o novo indicador.
