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
