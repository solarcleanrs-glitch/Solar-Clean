# Preparação do piloto oficial — Solar Clean

Estado: PREPARAÇÃO. Não autoriza publicação em main ou alterações no banco oficial.
Escopo proposto: primeiro piloto apenas com o usuário autenticado de Régis,
com autorização verificada no servidor por UUID/papel; nunca pelo nome digitado.

## Evidências aproveitadas (não repetir sem mudança relevante)

- Histórico Google 05/12/2022–30/10/2026, 1.983 IDs de evento únicos. Eventos não equivalem a clientes nem comprovam atendimento/pagamento.
- Importação individual e lotes de 1 e 3 cadastros confirmados no staging pelo gestor.
- Gaston: histórico exibe dois eventos, 19/09/2024 e 29/10/2026, vinculados ao mesmo cadastro. A foto do resultado confirma o caso real de vários eventos.
- Fechamentos, recebimentos, cancelamento/reabertura e diagnóstico financeiro sem divergências no staging.
- Dumps de testes decodificados e restaurados em PostgreSQL local; limites do ensaio estão em RECUPERACAO_STAGING_20261031.md.
- Cópia local por conta conferida no computador do gestor: 2 vistorias, 1 foto na inspeção, 0 pendências. Originais mantidos, cópia ainda sem uso operacional.
- Ensaios automáticos e de IndexedDB sintético passaram. Não comprovam RLS da produção nem sincronização real entre aparelhos.

## Critérios que bloqueiam a liberação do piloto

| Critério | Situação | Evidência necessária |
| --- | --- | --- |
| Identificar URL, projeto e UUID do gestor no oficial | Não verificado | Conferência somente leitura da configuração e sessão reais |
| Backup da produção e dos arquivos privados | Pendente | Cópia datada, inventário de mídia e recuperação em destino isolado; o backup de testes não substitui |
| Armazenamento por conta em uso | Pendente | Integrar todos os acessores e filas, conferência de legado e teste A→B→A online/offline |
| Formulários, assinaturas e retornos assíncronos entre contas | Parcial | Limpeza/preservação de rascunhos e bloqueio dos resultados antigos em todos os caminhos |
| Permissões do piloto no servidor | Pendente | Usuário gestor permitido; usuário sem permissão não lê nem escreve os módulos novos |
| Fluxo de campo com pacote candidato | Pendente | Nova vistoria, foto, assinatura, PDF, offline, reconexão e conferência sem duplicidade |
| Plano de retorno sem perda | Preparado abaixo, não ensaiado no oficial | Restaurar versão de código anterior sem descartar dados criados no piloto |

Perfis de campo, comercial, financeiro e parceiros não entram no primeiro piloto
até seus escopos por unidade/parceiro serem validados. Testes com UI de gestor não
comprovam essas permissões.

## Sequência concreta de implantação

1. Concluir bloqueios em staging e congelar um commit candidato com checks aprovados.
2. Conferir a produção em leitura e preparar backup/mídia e a migração específica para seu esquema real.
3. Ensaiar atualização e retorno numa cópia isolada da produção; não usar dados de testes como cadastro oficial.
4. Apresentar diff, módulos liberados, migrações, usuários permitidos e ponto de retorno para decisão conjunta.
5. Após decisão, aplicar primeiro estrutura compatível/aditiva e piloto por autorização de servidor. Só depois ampliar equipe.

Não copiar para produção os cadastros e lançamentos sintéticos do staging.
Clientes antigos serão importados do JSON preservado com conferência e identidade
de origem, reaproveitando o método validado. Segredos não pertencem ao navegador,
repositório, prints ou arquivos de implantação.

## Retorno preparado

- Guardar commit/configuração anteriores, versão do cache e esquema observado.
- Desativar módulos do piloto por configuração autorizada e voltar ao código anterior quando compatível.
- Preservar tabelas, filas e registros do piloto para reconciliação; não executar DROP/TRUNCATE nem restaurar dump sobre o banco ativo automaticamente.
- Se falha envolver dados, suspender as escritas afetadas e conferir diferenças em cópia isolada antes de qualquer recuperação.
- Um envio com resposta perdida pode já existir no servidor: reconciliar pelo mesmo UUID, sem gerar outra intenção.

## Próxima evidência externa necessária

Identificação e acesso somente leitura ao projeto oficial e ao método de backup
usado nele. Ainda não foi pedido login/senha, publicado código em main ou alterada
produção. Não é necessário repetir o teste de vínculo de Gaston nem a cópia local
já conferida apenas para preencher este roteiro.


## Identificação informada pelo gestor

- Aplicativo oficial: https://solarcleanrs-glitch.github.io/Solar-Clean/
- Projeto oficial indicado: beeucewgvktmahoidhrg.
- Projeto de testes: zzphucuiqhzrilrddxnf; são projetos distintos.
- A ligação efetiva do navegador ao banco oficial ainda exige conferência da configuração local; o código main lê essa configuração do aparelho.
- Diagnóstico preparado: supabase/diagnostics/inventario_OFICIAL_somente_leitura.sql. Somente catálogos de estrutura, permissões, políticas e RLS; não consulta dados de clientes, fotos ou senhas. Precisa ser executado no SQL Editor do projeto oficial informado, pois não há acesso direto ao banco nesta sessão. Não executado até retorno do gestor.

Não adaptar o código simplesmente trocando o ID de staging: os controles dependem de schema, autenticação e permissões efetivamente encontrados no oficial. Backup e mídia da produção continuam sem verificação.

## Atualização do ensaio de recuperação e compatibilidade

O gestor confirmou cópia do dump e mídia no disco E:, decodificação do dump,
restauração local de public/auth/storage, contagens comparadas para as tabelas
do aplicativo e Storage e chave primária de storage.objects conferida. Uma carga
local repetida foi descartada e auth/storage foram restaurados novamente uma
única vez. A confirmação final não apresentou IDs duplicados.

Este é um ensaio de recuperação de dados: --no-owner/--no-privileges não valida
as permissões originais; não executa Auth, Storage HTTP, Realtime ou a aplicação
completa. Não substitui cópia externa nem inventário byte a byte da mídia.

O ensaio sintético test:ledger:text-ids executa o financeiro com IDs de agenda
textuais não UUID, conservando os demais IDs como UUID. Adapta em memória apenas
o tipo da FK agenda_id e os recordsets JSON. Exercita criação, replay, rejeição
de duplicados, revisões, pagamentos, cancelamento e bloqueios por papel.
Não é migração para o oficial: a fixture ainda usa os outros campos e controles
de staging. Faltam migração aditiva do esquema legado, autenticação coordenada,
isolamento local operacional e os demais critérios de piloto acima.

### Ensaio estrutural da agenda legada — 01/11

Arquivo exclusivo do laboratório: supabase/rehearsals/20261101_agenda_legada_LOCAL_ONLY.sql.
Teste: npm --prefix tests/postgres run test:agenda:legacy. Adiciona revision,
maps_url, sc_escopo_id e arquivado_em; mantém id text e todos os valores legados.
Fixture PostgreSQL valida IDs não UUID, campos nulos, unidade desconhecida,
status legado, valores monetários, datas e mídia não relacionada preservados.
Reexecução e ID de tipo incompatível falham sem alterações parciais.
Não instala FK de escopo, gatilho de revisão, CAS ou permissões. Esses mecanismos
exigem desenho coordenado e verificação independente antes de qualquer piloto.
Não foi executado contra o dump real nem publicado em produção.

O ensaio financeiro com IDs textuais agora parte da tabela legada anulável e
executa a adaptação aditiva antes dos testes de fechamento. Candidato isolado:
supabase/rehearsals/20261101_fechamentos_text_LOCAL_ONLY.sql. Rejeita explicitamente
unidade/status/data ausentes e valores cobrados/recebidos ausentes ou recebidos
negativos; registros antigos não elegíveis permanecem preservados. Casos de
pagamento, replay, cancelamento, revisão e negação de acesso passaram no banco
embutido. A fundação de acesso e os triggers continuam sendo fixtures de staging:
isso não comprova uma migração completa sobre o dump nem autoriza execução remota.

O adaptador de intents aceita agendaIdType=text somente por opção explícita para
preparação de ensaio. IDs textuais preservam caixa e conteúdo; UUID continua como
padrão. sendIntent mantém a validação UUID e o bloqueio ao projeto de testes:
nenhuma ativação remota foi adicionada. O ensaio SQL legado usa agora os itens
construídos pelo adaptador real, em vez de JSON manual. Testes de adaptador,
journal e UI passaram, incluindo rejeição de IDs textuais antes de qualquer fetch.

Preparação financeira e projeção de saldo agora rejeitam valores ausentes,
booleanos, texto vazio e números inválidos, em vez de convertê-los silenciosamente
para zero. Testes de UI confirmam bloqueio de salvar e ausência de POST quando
recebido legado é inválido; a projeção não exibe quitação com recebimento ausente.
A suíte rápida completa e verificação dos bundles passaram após essa mudança.
Mudanças apenas no workspace; não publicadas no staging ou no oficial nesta etapa.
