-- CONSULTA SOMENTE LEITURA — executar exclusivamente em Solar Clean testes crm
-- Verifica colunas, chaves, gatilhos e políticas antes de qualquer migração.
select 'coluna' as tipo, column_name as nome, data_type as detalhe
from information_schema.columns
where table_schema='public' and table_name='vistorias'
union all
select 'constraint', conname, pg_get_constraintdef(c.oid)
from pg_constraint c where c.conrelid='public.vistorias'::regclass
union all
select 'trigger', tgname, pg_get_triggerdef(t.oid)
from pg_trigger t where t.tgrelid='public.vistorias'::regclass and not t.tgisinternal
union all
select 'policy', policyname, cmd || ' | ' || coalesce(qual,'') || ' | ' || coalesce(with_check,'')
from pg_policies where schemaname='public' and tablename='vistorias'
order by tipo,nome;
