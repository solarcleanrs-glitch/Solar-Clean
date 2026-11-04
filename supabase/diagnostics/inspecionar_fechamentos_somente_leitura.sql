-- Somente metadados; executar exclusivamente em Solar Clean testes crm.
select jsonb_build_object(
 'tabelas', (select jsonb_agg(jsonb_build_object('tabela',c.relname,'rls_ativo',c.relrowsecurity))
   from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname in ('sc_fechamentos','sc_fechamento_itens','sc_fechamento_recebimentos')),
 'politicas', (select jsonb_agg(jsonb_build_object('tabela',tablename,'nome',policyname,'operacao',cmd,'condicao',qual))
   from pg_policies where schemaname='public' and tablename in ('sc_fechamentos','sc_fechamento_itens','sc_fechamento_recebimentos')),
 'permissoes', (select jsonb_agg(jsonb_build_object('tabela',table_name,'papel',grantee,'operacao',privilege_type))
   from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','PUBLIC')
   and table_name in ('sc_fechamentos','sc_fechamento_itens','sc_fechamento_recebimentos'))
) as verificacao_fechamentos;
