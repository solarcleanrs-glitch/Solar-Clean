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
