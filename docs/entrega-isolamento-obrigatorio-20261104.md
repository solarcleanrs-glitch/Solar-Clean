# Candidata 44 — dados locais por conta

O projeto de testes passa a abrir IndexedDB e as chaves de agenda, clientes, metadados e contatos no espaço do usuário autenticado, mesmo sem o antigo marcador de ativação. O marcador continua indicando apenas uma cópia de legado conferida; não é criado automaticamente. Dados antigos permanecem intactos e não são atribuídos a ninguém.

Os domínios principal e previews do site de testes nunca usam a base antiga por falta de configuração ou por ausência do módulo. Os previews também recusam configuração de projeto oficial. Outros projetos conservam o roteamento anterior. Sem conta, os atalhos de trabalho ficam bloqueados e o resumo não lê a base antiga.

A candidata ativa a preservação de formulário por conta no site de testes, incluindo previews. Login/logout preservam antes de trocar tokens; falha de espaço bloqueia a troca. Após a troca, limpa formulário, fotos, assinaturas, relatórios, listas, editores de valores, mapa de clientes da agenda, filtros e dados em memória. Operações antigas continuam protegidas pelas guardas de sessão existentes.

O ensaio completo encontrou e corrigiu uma falha adicional: o cofre de um formulário recuperado usava o contexto vivo, diferente do formulário recém-aberto. Após logout externo, a preservação podia falhar. A recuperação agora captura o proprietário original, mantendo a verificação da sessão antes e depois de restaurar.

## Evidências

- `tests/scoped-local-runtime.test.cjs`: isolamento obrigatório sem marcador, A/B/A, logout sem retorno ao legado e preservação das chaves originais.
- `tests/account-draft-session.test.cjs`: cópia recuperada continua vinculada à origem após mudança externa.
- `tests/account-isolation.browser.cjs`: aplicativo completo em Chromium, 412×915, domínio principal e preview, autenticação fictícia. Verifica filas, foto, CRM, formulário incompleto, limpeza de valores/cache, A/B/A, notificação externa de logout e legado intocado. O evento externo é simulado; não equivale a ensaio de duas sessões Auth reais.
- Fixtures são geradas a partir do HTML fonte, bloqueiam rede real e bancos fora dos UUIDs sintéticos. Não lêem tokens ou dados do navegador do usuário.

## Antes de integrar na homologação principal

1. Concluir a recuperação seletiva do legado após conferência de propriedade. A candidata substitui a ferramenta antiga por conferência/download somente leitura, disponível ao gestor global após validação online. A cópia preserva fotos e texto bruto das quatro chaves operacionais, exclui tokens e não declara que os dados pertencem ao revisor. Reconfere acesso, sessão e fonte antes do download; não importa nem sincroniza. Formatos não serializáveis são recusados sem alterar a origem. Uma importação posterior exige plano de conciliação de IDs e conflitos, sem sobrepor pendências novas.
2. Integrar capacidades reais do servidor aos módulos e unidades. Separar dados por usuário não substitui autorização nem resolve cache antigo após revogação de unidade.
3. Completar escrita de vistoria/fotos por técnico e teste de fluxo diário, inclusive aparelho físico, sem perda/duplicação.
4. Não aplicar a migração de permissões nem ativar funcionários apenas por este ensaio. Esta revisão é rascunho de testes, sem alteração no banco ou no oficial.

`tests/legacy-local-review.test.cjs` verifica recusa antes da primeira leitura, permissão revogada, troca de sessão, fonte alterada, formatos binários não suportados, preservação de fotos/texto ilegível e exclusão de tokens. O cenário de navegador verifica recusa offline e executa o leitor IndexedDB em uma base sintética redirecionada, sem modificar as linhas.
