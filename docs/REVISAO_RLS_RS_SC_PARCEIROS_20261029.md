# Revisão de segurança RLS — 29/10/2026
**Status: revisão estática; nenhuma política aplicada.** Somente branch de homologação.

## Achado bloqueador
As migrações propostas `20261028_crm_contatos_staging.sql`, `20261028_crm_perfis_staging.sql` e `20261028_crm_metadados_staging.sql` autorizam qualquer usuário presente em `crm_usuarios` a consultar os dados de todos os clientes dessas tabelas. A tabela `crm_usuarios` contém somente `user_id`, sem unidade ou parceiro. Portanto **não existe isolamento RS/SC ou entre parceiros demonstrado por essas políticas**. Não aplicar estas políticas como solução de segregação.

## Pré-requisitos de desenho
1. Definir papéis por usuário (gestor, técnico, parceiro), unidades permitidas e vínculo de parceiro; não confiar em campos enviados pelo navegador.
2. Definir propriedade e unidade dos clientes, agendamentos, vistorias, fotos e histórico importado; usar identificadores imutáveis.
3. Garantir que leitura e escrita usem a mesma regra no banco; impedir troca de unidade/parceiro por UPDATE.
4. Fotos privadas: autorização deve acompanhar o cliente/vistoria e não apenas a autenticação geral.
5. Financeiro e observações internas: separar privilégios por função, inclusive em respostas REST.
6. Decidir se gestor pode visualizar ambas unidades e se parceiros podem ver apenas horários e relatórios próprios.
7. Criar migração *nova* e reversível após inspecionar esquema atual do projeto de testes; não editar políticas em produção.
8. Testar com JWTs de contas fictícias e requisições diretas REST; SQL Editor como administrador não valida RLS.

## Testes negativos indispensáveis
- Técnico RS consulta e tenta atualizar registro SC: negar.
- Técnico SC consulta e tenta atualizar registro RS: negar.
- Parceiro A consulta cliente, relatório e foto do parceiro B: negar.
- Parceiro A tenta alterar `partner_id` ou `unit` do próprio registro: negar.
- Usuário não cadastrado tenta SELECT/INSERT/UPDATE em tabelas CRM: negar.
- Parceiro tenta consultar notas internas, valores e contatos de outros clientes: negar.

## Próxima etapa
Inspecionar em modo leitura as colunas, FKs, RLS e políticas reais do Supabase de testes. Somente então preparar migração compatível e executar testes negativos. Não utilizar dados pessoais reais.
