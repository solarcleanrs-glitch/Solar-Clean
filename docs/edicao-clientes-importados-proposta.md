# Proposta de edição de clientes importados — ainda não aplicada

O SQL em `supabase/proposals/imported-client-edit.sql` é uma proposta testada
em PostgreSQL isolado. Não pertence à pasta de migrações e não deve ser
executado em produção. Ainda não existe botão de edição no aplicativo.

## Contrato

Somente gestor ativo e membro cadastrado pode consultar o editor ou alterar
nome, telefone, cidade, endereço e status comercial. Técnico, parceiro,
financeiro, anônimo e contas desconhecidas são recusados. Origem, unidade,
parceiro, cadastro inicial e referências Google não são campos editáveis.

`sc_cliente_edicao` devolve somente o cadastro atual e sua revisão.
`sc_editar_cliente` exige UUID de tentativa, cliente explícito, revisão lida
e os cinco campos completos. O bloqueio da linha e a comparação de revisão
recusam a gravação de uma versão antiga; não há sobrescrita automática.

O UUID da tentativa é serializado e guardado no histórico privado. Repetição
com mesmo autor, cliente, revisão e conteúdo confirma sem duplicar. O mesmo
UUID com outros dados é recusado. A confirmação repetida informa a revisão
produzida por aquela operação; o aplicativo precisa reler o cadastro atual,
pois outra edição pode ter ocorrido depois.

O histórico registra autor, horário e dados antes/depois. RLS e revogação de
permissões impedem leitura ou alteração direta pela API. Não há funções de
exclusão ou alteração do histórico. As funções privilegiadas ficam em schema
privado com search_path vazio e autorização no servidor; wrappers públicos
usam security invoker.

O status inicial proposto é “Em conferência”, sem classificar automaticamente
um importado como ativo. Os demais valores seguem os termos já usados no CRM:
Ativo, Recorrência pendente, Recuperação, Inativo e Não contatar.
Nesta proposta o status não integra o CRM antigo, recorrência ou WhatsApp.
Antes de liberar o formulário, “Não contatar” precisa ser respeitado pelos
fluxos de contato aplicáveis; não basta exibir o campo.

## Testes e próximos passos

`tests/imported-client-edit-db.integration.cjs` exercita edição, tentativa
repetida, conflito de revisão, campos indevidos, tipos/status/telefone
inválidos, papéis negados, revogação e acesso direto proibido. Também executa
a função original de importação depois de uma edição e confere que o cadastro
corrigido permanece e a origem não é duplicada.

A CLI do Supabase não estava disponível e sua obtenção foi interrompida por
cancelamento da aprovação de rede. Nenhuma migração foi improvisada ou aplicada
remotamente. Quando a CLI estiver disponível, gerar uma migração, revisar
diferenças e executar os testes/advisors do projeto de testes antes da aplicação.

Ainda faltam integração de formulário/API, histórico de edição consultável
pelo gestor, tratamento de conflito e resposta incerta, proteção dos fluxos de
contato e validação autenticada de ponta a ponta. A proposta não libera contas,
não envia mensagens e não altera clientes, fotos ou vistorias remotos.
