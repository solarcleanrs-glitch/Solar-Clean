# Matriz de homologação — RS/SC, parceiros e histórico
Escopo exclusivo: branch feature/crm-whatsapp-recorrencia-20261028 e projeto Supabase Solar Clean testes crm.
Documento de preparação; nenhum caso abaixo está aprovado sem evidência de execução. Não usar dados reais.

## Preparação
- Criar usuários fictícios: gestor Regis-teste, técnico RS-teste, técnico SC-teste, parceiro A-teste, parceiro B-teste e usuário sem cadastro.
- Criar clientes e agendamentos fictícios de ambas as unidades, vinculando dois clientes distintos a cada parceiro.
- Registrar para cada caso: data, conta fictícia, operação, resposta HTTP, resultado UI e evidência sem tokens.
- Conferir políticas RLS por requisição REST com JWT de cada usuário; filtro visual não é controle de acesso.

## Casos de aceite
| ID | Perfil | Operação | Resultado obrigatório |
| --- | --- | --- | --- |
| U01 | Gestor | Alternar RS/SC na agenda | Lista correta por unidade, sem alterar agendamentos |
| U02 | Técnico RS | Consultar agendamentos SC via API | Acesso negado ou nenhuma linha |
| U03 | Técnico SC | Consultar agendamentos RS via API | Acesso negado ou nenhuma linha |
| U04 | Técnico RS | Alterar vistoria SC via API | Escrita negada |
| U05 | Sem cadastro | Consultar CRM e fotos privadas | Acesso negado |
| P01 | Parceiro A | Cadastrar seu cliente | Registro vinculado ao parceiro A |
| P02 | Parceiro A | Consultar cliente do parceiro B via API | Acesso negado ou nenhuma linha |
| P03 | Parceiro A | Consultar relatório do parceiro B | Acesso negado, inclusive URL de foto |
| P04 | Parceiro A | Consultar horário do próprio cliente | Apenas horário e dados permitidos |
| P05 | Parceiro A | Alterar pagamento ou nota interna | Escrita negada |
| S01 | Técnico | Editar offline e sincronizar | Sem perda, fila só conclui após confirmação remota |
| S02 | Dois dispositivos | Editar mesmo registro | Conflito sinalizado, nenhuma sobrescrita silenciosa |
| S03 | Técnico | Repetir envio e download | Sem duplicar vistoria ou fotos |
| H01 | Gestor | Prévia de histórico fictício | Contagem e deduplicação visíveis, sem escrita |
| H02 | Gestor | Reimportar lote fictício | Mesmos IDs; nenhum cliente ou serviço duplicado |
| H03 | Gestor | Importar evento sem telefone | Mantém pendência de revisão, sem mescla por primeiro nome |
| H04 | Gestor | Importar serviço antigo | Histórico não vira vistoria assinada nem receita |
| H05 | Gestor | Simular cliente Não contatar | Nenhum envio automático de WhatsApp |

## Bloqueadores
- Não importar dados reais do Google Calendar no projeto fictício.
- Não aprovar segregação RS/SC nem parceiros com base apenas em filtros da interface.
- Não aplicar migrações, grants ou políticas RLS sem revisão de dependências e backup do projeto de testes.
- Não ativar automação de WhatsApp, publicar app ou modificar produção.
- Marcar cada caso como **não executado** até haver evidência concreta de teste.
