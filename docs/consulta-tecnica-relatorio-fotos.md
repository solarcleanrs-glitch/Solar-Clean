# Consulta técnica de relatório e fotos — testes

Disponível no banco de testes, sem ativar contas ou modificar a interface atual.
`sc_relatorio_campo(p_vistoria uuid)` recebe o `client_uuid` da vistoria e retorna
um JSON técnico ou `null` quando o registro não existe ou está fora do escopo.
Conta ausente, desativada ou sem papel operacional recebe erro de autorização.
O usuário vem de `auth.uid()`; nenhum ID de usuário, nome ou e-mail é aceito
como argumento de autorização.

Gestor ativo mantém acesso inclusive aos registros sem classificação. Técnico
depende de unidade autorizada e escopo explícito. Parceiro depende também do
parceiro correspondente ativo. Financeiro não recebe acesso por essa consulta.
O vínculo em `crm_usuarios` continua obrigatório. A consulta não amplia a leitura
direta da tabela `vistorias`, que permanece protegida pelo bloqueio de transição.

Uma lista explícita define os campos técnicos. Não retorna pagamentos, valores,
observações internas, e-mail técnico, assinaturas ou escopo interno. É uma
projeção para consulta, não o PDF completo com assinaturas. Campos novos na
tabela não entram automaticamente na resposta.

## Fotos

O manifesto retornado contém apenas imagens JPEG/PNG/WebP nas categorias
Antes, Depois, Telhado, Problema ou Foto, com caminho pertencente ao UUID da
vistoria. Arquivo interno, categoria desconhecida, caminho externo e travessia
de diretório são excluídos. Metadados extras também não são repassados.

O Storage verifica correspondência exata entre o caminho solicitado e esse
manifesto autorizado. Adivinhar o prefixo da vistoria ou o nome de um arquivo
interno não concede leitura. O gestor mantém acesso anterior para conferência.
O usuário de campo continua sem INSERT, UPDATE ou DELETE no bucket protegido;
políticas restritivas adicionais impedem mover uma foto para outro bucket.
As políticas permissivas anteriores ainda precisam autorizar a operação.
Outros buckets mantêm suas condições anteriores, sem nova permissão.

A política de transição não foi removida: sua condição de leitura foi ajustada,
mantendo o WITH CHECK de escrita restrito ao gestor. A alteração e as novas
condições foram aplicadas juntas pela migração. Nenhuma linha ou arquivo mudou.

## Verificação e limites

`NODE_PATH=./tests/postgres/node_modules node tests/scoped-report-db.integration.cjs`

PostgreSQL isolado: gestor, técnicos RS/SC, parceiros diferentes, conta sem
acesso, financeiro, anônimo, revogação, parceiro desativado, relatório ausente,
registro sem escopo, ocultação de campos privados, exclusão de fotos internas,
caminhos falsos, leitura sem escrita/exclusão e preservação dos originais.

Supabase de testes: transação SQL somente leitura confirmou projeção técnica,
acesso preservado do gestor e bloqueios de outra conta/anônimo/foto inválida.
Impressões digitais de vistorias e objetos do Storage ficaram iguais. Isso
não é teste HTTP com uma conta real de técnico ou parceiro.

Falta integrar a projeção na interface específica de campo e validar uma sessão
de técnico/parceiro antes de ativar esses perfis. CRM e escrita operacional
permanecem em etapas separadas. A versão oficial não foi alterada. Não aplicar
a migração automaticamente em produção nem desfazer as proteções anteriores.
