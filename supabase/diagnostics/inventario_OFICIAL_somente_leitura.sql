-- Projeto esperado: beeucewgvktmahoidhrg (OFICIAL).
-- Abrir nesse projeto no SQL Editor. Apenas metadados; nenhuma linha de cliente.
-- Não instalar migrações de staging antes de analisar este resultado.
SELECT jsonb_build_object(
 'diagnostico', 'solar-clean-producao-estrutura-v1',
 'colunas', (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.table_schema,c.table_name,c.ordinal_position),'[]'::jsonb)
   FROM information_schema.columns c WHERE c.table_schema IN ('public','storage') AND
   (c.table_schema='public' OR c.table_name IN ('buckets','objects'))),
 'restricoes', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.table_name,t.constraint_name),'[]'::jsonb)
   FROM information_schema.table_constraints t WHERE t.table_schema='public'),
 'chaves', (SELECT coalesce(jsonb_agg(to_jsonb(k) ORDER BY k.table_name,k.constraint_name,k.ordinal_position),'[]'::jsonb)
   FROM information_schema.key_column_usage k WHERE k.table_schema='public'),
 'referencias', (SELECT coalesce(jsonb_agg(to_jsonb(k) ORDER BY k.table_name,k.constraint_name),'[]'::jsonb)
   FROM information_schema.constraint_column_usage k WHERE k.table_schema='public'),
 'politicas', (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.schemaname,p.tablename,p.policyname),'[]'::jsonb)
   FROM pg_policies p WHERE p.schemaname IN ('public','storage')),
 'permissoes', (SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY g.table_name,g.grantee,g.privilege_type),'[]'::jsonb)
   FROM information_schema.role_table_grants g WHERE g.table_schema='public' AND g.grantee IN ('anon','authenticated')),
 'rls', (SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'tabela',c.relname,'ativo',c.relrowsecurity,'forcado',c.relforcerowsecurity) ORDER BY n.nspname,c.relname),'[]'::jsonb)
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname IN ('public','storage') AND c.relkind IN ('r','p')),
 'funcoes_publicas', (SELECT coalesce(jsonb_agg(jsonb_build_object('nome',p.proname,'security_definer',p.prosecdef,'argumentos',p.pronargs,'permissoes',p.proacl::text) ORDER BY p.proname),'[]'::jsonb)
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public')
) AS diagnostico;
