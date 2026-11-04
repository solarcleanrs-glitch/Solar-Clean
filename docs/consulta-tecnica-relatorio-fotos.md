# Consulta técnica de relatório e fotos — testes

Disponível no banco de testes, sem ativar contas. A tela inicial possui o painel
“Agenda e relatórios por acesso — testes”: usa o período/unidade selecionados,
lista relatórios autorizados e abre a consulta técnica. Cada foto é carregada
apenas ao pressionar “Abrir foto”. A agenda principal e o PDF atual do gestor
continuam em seus fluxos anteriores.
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

Falta validar a interface com sessão real de técnico/parceiro antes de ativar
esses perfis. CRM e escrita operacional
permanecem em etapas separadas. A versão oficial não foi alterada. Não aplicar
a migração automaticamente em produção nem desfazer as proteções anteriores.

`sc_relatorios_campo(p_inicio,p_fim,p_unidade)` lista apenas identificador,
cliente, data e unidade dos relatórios autorizados pela mesma regra do detalhe.
Limite de 93 dias; datas interpretadas no fuso America/Sao_Paulo. Registros sem
classificação aparecem ao gestor apenas na opção de todas as unidades.

O painel não grava relatórios/fotos em armazenamento local e não usa o cache
antigo como alternativa a uma falha. Fotografias são baixadas com autenticação,
sem URL assinada pública, exibidas por URL de objeto em memória e revogadas ao
trocar de conta, filtros ou relatório. A autorização do servidor é verificada
no download; cópias já baixadas não são apagadas por revogação de acesso.

`field-report-api.test.cjs` e `field-report-ui.test.cjs` conferem a projeção,
tipo de imagem, ausência de token na URL, bloqueio de foto interna/estrangeira,
troca de conta durante download, limpeza das URLs, respostas atrasadas após
mudança de filtros, exibição correta do valor zero e data no fuso brasileiro.
