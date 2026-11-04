# Permissões da equipe — candidato de homologação

Esta proposta não foi aplicada ao Supabase e não ativa contas. Não publicar em produção. A migração compõe as migrações anteriores em PostgreSQL isolado, com identidades fictícias.

| Perfil solicitado | Regra candidata | Evidência e limite |
| --- | --- | --- |
| Régis: total | `gestor` global existente | Mantém leitura RS/SC e administração dos acessos. |
| Fabiano: total sem SC | Novo `gestor_unidade` com RS | Banco limita agenda, vistoria, mídia, importação/edição de clientes e financeiro a RS; não permite administrar acessos nem liberar SC para si. Catálogo de parceiros tem leitura compartilhada; escrita global permanece exclusiva do gestor. |
| David: agenda e vistoria | `tecnico` RS no ensaio | Projeções protegidas e status da agenda; sem tabelas financeiras/CRM brutas. Criação/edição de vistoria e envio de fotos pelo técnico continuam pendentes. RS é apenas hipótese restritiva do ensaio, a confirmar antes de ativar conta. |

## Validação reproduzível

`NODE_PATH=./tests/postgres/node_modules node tests/unit-manager-db.integration.cjs`

O teste executa as migrações reais em sequência, sem conexão hospedada. Verifica separação RS/SC, bloqueio de autoelevação, financeiro por unidade, importação com UUID/origem de SC falsificados, status protegido, reserva de fotos, bloqueio de apropriação de fotos órfãs e revogação imediata. A política provisória antiga de mídia também é corrigida; ela bloqueava a leitura técnica mesmo quando a projeção autorizava uma foto.

Código: `supabase/migrations/20261104222525_unit_manager_permissions_staging.sql`. Funções privilegiadas novas ficam no esquema privado, com wrappers públicos invoker. As alterações de funções existentes verificam o catálogo e falham diante de divergência, em vez de aplicar substituições silenciosas.

## Sequência antes de ativar pessoas

1. Integrar `gestor_unidade` às capacidades da interface e chamar a reserva de mídia antes de criar vistoria/enviar fotos. Isolar armazenamento local e filas por projeto/usuário; cache legado não pode aparecer ao trocar de conta.
2. Completar escrita técnica de vistoria/fotos e restringir a navegação de David aos módulos solicitados. A projeção atual de clientes também aceita técnico; o escopo final dessa consulta precisa ser decidido antes da ativação.
3. Revisar o esquema real (inclusive IDs legados textuais), executar os testes na homologação e verificar advisors. Só então cadastrar/confirmar as contas e unidades, aplicar a migração no teste e validar com sessões separadas.

Não criar contas reais por inferência, reutilizar uma conta pessoal como funcionário, classificar dados antigos por nome/cidade, nem atribuir o papel global ao gestor limitado. Registros sem escopo confirmado e chaves antigas ambíguas permanecem reservados ao gestor global.
