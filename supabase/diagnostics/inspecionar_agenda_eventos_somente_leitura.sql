-- Somente leitura, exclusivamente Solar Clean testes crm / zzphucuiqhzrilrddxnf.
-- Nome confirmado no código: agenda_eventos. Não consulta dados de agendamentos.
select jsonb_build_object(
  'colunas', (
    select jsonb_agg(jsonb_build_object(
      'nome', column_name, 'tipo', data_type, 'aceita_nulo', is_nullable
    ) order by ordinal_position)
    from information_schema.columns
    where table_schema='public' and table_name='agenda_eventos'
  ),
  'politicas', (
    select jsonb_agg(jsonb_build_object(
      'nome', policyname, 'modo', permissive, 'operacao', cmd,
      'papeis', roles, 'condicao', qual, 'validacao', with_check
    ) order by policyname)
    from pg_policies
    where schemaname='public' and tablename='agenda_eventos'
  ),
  'rls', (
    select jsonb_agg(jsonb_build_object(
      'ativo', c.relrowsecurity, 'forcado', c.relforcerowsecurity
    ))
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='agenda_eventos' and c.relkind in ('r','p')
  )
) as diagnostico;
