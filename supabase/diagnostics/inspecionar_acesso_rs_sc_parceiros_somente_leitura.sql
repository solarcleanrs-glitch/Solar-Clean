-- SOMENTE LEITURA. Executar EXCLUSIVAMENTE no projeto Supabase "Solar Clean testes crm".
-- Não retorna linhas de clientes, senhas, tokens ou conteúdo de relatórios.
-- Confirmar o identificador do projeto antes de executar.
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public'
  and (table_name like 'crm_%' or table_name in ('clientes','agendamentos','agenda','vistorias','parceiros'))
order by table_name, ordinal_position;
select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p')
  and (c.relname like 'crm_%' or c.relname in ('clientes','agendamentos','agenda','vistorias','parceiros'))
order by c.relname;
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname='public'
  and (tablename like 'crm_%' or tablename in ('clientes','agendamentos','agenda','vistorias','parceiros'))
order by tablename, policyname;
select tc.table_name, tc.constraint_name, tc.constraint_type,
       kcu.column_name, ccu.table_name as foreign_table, ccu.column_name as foreign_column
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_name=kcu.constraint_name and tc.table_schema=kcu.table_schema
left join information_schema.constraint_column_usage ccu
  on tc.constraint_name=ccu.constraint_name and tc.table_schema=ccu.table_schema
where tc.table_schema='public'
  and (tc.table_name like 'crm_%' or tc.table_name in ('clientes','agendamentos','agenda','vistorias','parceiros'))
order by tc.table_name, tc.constraint_name;
