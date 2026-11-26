# Exportação de contatos — ambiente de testes

A interface está limitada ao projeto zzphucuiqhzrilrddxnf. Não publicar em main antes da validação.

## Contrato pendente do banco
A consulta autenticada usa crm_export_contacts com id estável, cliente, cidade, telefone, unidade (RS/SC), ultima_limpeza (date ou null), autorizacao (boolean, false por padrão) e status_comercial. A origem deve consolidar clientes, vistorias e agenda concluída, nunca usar data de cadastro como limpeza. Eventos antigos sem evidência de conclusão mantêm data nula.

Antes de expor a relação, confirmar o esquema e políticas reais do projeto. Usar RLS ou view security_invoker sobre fontes com RLS. Revogar acesso anon. Restringir a leitura a gestores autorizados via app_metadata.contact_export_units, configurado exclusivamente no servidor. Garantir exclusão de números bloqueados ou com consentimento conflitante inclusive entre unidades e registros antigos, sem revelar dados de outra unidade. Não usar a chave anon como identidade de usuário. Se houver dúvida, excluir o contato.

## Autorização
Implementar registro de opt-in por contato e unidade, com data, origem, responsável e revogação. Não presumir consentimento de clientes antigos. Não contatar prevalece sobre autorização. A interface de registro e integração das fontes ainda estão pendentes.

## Validação antes da publicação
- Verificar autenticação real e acesso RS/SC de cada perfil, inclusive chamadas REST diretas.
- Verificar paginação, duplicatas interunidades, revogação entre prévia e download, e números desconhecidos.
- Confirmar que somente datas de limpezas efetivas alimentam o filtro.
- Importar CSV de contatos fictícios no Google Contatos.
- Confirmar funcionamento offline/erro sem exportação e atualização do service worker.
- Validar advisors de segurança e testes do banco.
- Somente depois retirar a restrição ao projeto de testes em uma revisão separada.

A consulta ao banco de testes falhou por timeout. Nenhuma migração foi aplicada, e a exportação fica bloqueada até que a relação segura exista.

## Conferência do esquema em 26/11/2026

O SQL Editor do projeto de testes respondeu às consultas de leitura. `sc_clientes` contém ID, telefone, unidade e status comercial, e `sc_cliente_origens_google` registra a origem por cliente. A relação `crm_export_contacts` ainda não existe.

A agenda de testes tem dois registros com status `Concluído`. Nenhum registro da agenda correspondeu pelo identificador Google aos registros de origem. A data da última limpeza deve permanecer nula até ser confirmada por um vínculo de cliente e uma execução comprovada. Não usar o status de conferência dos contatos importados como autorização. Nenhum registro do banco foi alterado nesta conferência.
