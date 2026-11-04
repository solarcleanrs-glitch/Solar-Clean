# Revisão de compatibilidade e segurança do CRM — 28/10/2026

**Escopo:** inspeção estática do `index.html` da branch `feature/crm-whatsapp-recorrencia-20261028`, comparado com `main`. Nenhuma consulta nem alteração ao banco de produção.

## Confirmado no código
- `crm_contatos` e `crm_perfis` usam `crmHistoryCloudHeaders()` com token de login do técnico, além da chave pública.
- `crm_clientes` (metadados: status, último contato, motivo de perda, observação interna) continua usando `cloudHeaders()`, que envia a chave pública como Bearer.
- `clientes` (cadastros avulsos) também usa `cloudHeaders()`. Permissões reais no banco de produção são **desconhecidas**.
- `syncAll()` envia e recebe vistorias; não é o mecanismo correto para validar somente o CRM.
- Não existe no repositório uma migração comprovadamente aplicada em produção para as três tabelas novas; as migrações na branch são arquivos de proposta para homologação.

## Bloqueadores antes de mesclar/publicar
1. **Inspecionar sem alterações as políticas RLS, grants e esquemas atuais** de `crm_clientes`, `clientes`, `vistorias`, `crm_contatos`, `crm_perfis` e `crm_usuarios` no Supabase principal. Não criar, apagar, revogar nem alterar políticas antes de revisar o resultado.
2. Unificar autorização do CRM: exigir sessão autenticada e políticas RLS em todas as tabelas comerciais; não expor `internal_note` ou informações pessoais por regras anônimas. Avaliar o fluxo atual de login, tokens expirados e a equipe autorizada.
3. Fazer teste **negativo real** (JWT de usuário não autorizado): requisições diretas SELECT/INSERT para `crm_contatos` e SELECT/INSERT/UPDATE para `crm_perfis`, além da UI vazia. O SQL Editor normalmente atua como administrador e não comprova bloqueio de RLS.
4. Validar cenário de login expirado, sincronização offline, duplicação por identificador de telefone e integração de `crm_clientes` com a tabela existente.
5. Testar migrações em homologação e revisar backups antes de qualquer execução em produção.

## Consulta SOMENTE DE LEITURA, destinada à análise humana
Executar apenas com o projeto principal claramente identificado e após verificar que não contém comandos de escrita:

```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema='public'
  and table_name in ('crm_clientes','clientes','crm_contatos','crm_perfis','crm_usuarios','vistorias')
order by table_name, ordinal_position;

select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname='public'
  and tablename in ('crm_clientes','clientes','crm_contatos','crm_perfis','crm_usuarios','vistorias')
order by tablename, policyname;

select c.relname as tabela, c.relrowsecurity as rls_ativada
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
  and c.relname in ('crm_clientes','clientes','crm_contatos','crm_perfis','crm_usuarios','vistorias')
  and c.relkind in ('r','p')
order by c.relname;
```

**Não usar** `DROP POLICY`, `ALTER TABLE`, `GRANT`, `REVOKE` ou `INSERT` em produção até que haja revisão e autorização explícita. Não compartilhar conteúdo de linhas de clientes, senhas ou tokens em capturas.
