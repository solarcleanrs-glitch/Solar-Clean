# Restrição dos caminhos antigos — testes

Em 02/11/2026 foram adicionadas cinco políticas restritivas no banco de testes:
vistorias, perfis do CRM, metadados do CRM, contatos e objetos do bucket
`vistoria-media`. Exigem gestor ativo por UUID na tabela de acesso. As políticas
antigas permanecem, mas não podem contornar a condição restritiva. Nenhuma linha
ou arquivo foi apagado, classificado ou transferido.

Esta é uma proteção transitória. Técnico, parceiro e financeiro não recebem
acesso direto a essas tabelas ou a esse bucket por esta etapa. A consulta de
agenda por acesso continua separada e somente leitura. Não cadastrar contas
de campo antes de concluir a interface e as consultas seguras de relatório,
foto, CRM e escrita operacional.

O gestor mantém as permissões anteriores, condicionado às políticas permissivas
e aos grants existentes. Outros buckets continuam sujeitos às políticas
anteriores: a nova política não acrescenta nenhuma permissão a eles.

## Verificação

`NODE_PATH=./tests/postgres/node_modules node tests/legacy-report-media-guard-db.integration.cjs`

O teste reproduz uma política permissiva antiga e prova que ela não contorna
o bloqueio de leitura/escrita, inclusive ao mover objeto entre buckets. Também
testa gestor ativo, revogação, preservação dos originais e comportamento dos
outros buckets no PostgreSQL isolado com dados sintéticos.

No banco de testes, conferência SQL em transação somente leitura confirmou
contagens preservadas para o gestor e ausência de leitura para conta sem
autorização. Impressões digitais de todas as cinco tabelas foram iguais antes
e depois da migração. O ensaio SQL não substitui autenticação HTTP real nem
teste com uma conta de técnico cadastrada.

URLs assinadas anteriormente emitidas podem continuar válidas até expirar;
essas políticas não retiram cópias já baixadas de outros aparelhos. Não houve
exclusão de arquivos, tokens ou cópias locais.

## Reversão e produção

A reversão técnica exige remover apenas as cinco novas políticas, após revisão;
ela reabre o comportamento antigo e não deve ser automática. Não desligar RLS.
A migração é exclusiva de testes e não foi aplicada em produção. O oficial
exige adaptação de estrutura e implantação coordenada com a versão do app.
