-- Apenas laboratório local restaurado. Execute com psql ON_ERROR_STOP=1.
-- Nenhum dado de cliente é exibido; todas as alterações são revertidas.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$
begin
 if current_database()<>'solar_clean_oficial_restore' then
  raise exception 'Use somente o banco local solar_clean_oficial_restore';
 end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='agenda_eventos' and column_name='id' and data_type='text') then
  raise exception 'Agenda legada com id text obrigatória';
 end if;
end;
$$;
create temporary table sc_ensaio_antes on commit drop as
 select 'agenda'::text as tipo,to_jsonb(a) as registro from public.agenda_eventos a
 union all select 'vistorias',to_jsonb(v) from public.vistorias v
 union all select 'crm',to_jsonb(c) from public.crm_clientes c;
alter table public.agenda_eventos
 add column revision bigint not null default 1 check(revision>=1),
 add column maps_url text not null default '',
 add column sc_escopo_id uuid,
 add column arquivado_em timestamptz;
create temporary table sc_ensaio_depois on commit drop as
 select 'agenda'::text as tipo,to_jsonb(a)-array['revision','maps_url','sc_escopo_id','arquivado_em'] as registro from public.agenda_eventos a
 union all select 'vistorias',to_jsonb(v) from public.vistorias v
 union all select 'crm',to_jsonb(c) from public.crm_clientes c;
do $$
begin
 if exists(
   (select * from sc_ensaio_antes except all select * from sc_ensaio_depois)
   union all
   (select * from sc_ensaio_depois except all select * from sc_ensaio_antes)
 ) then raise exception 'Diferença encontrada nos registros originais'; end if;
 if exists(select 1 from public.agenda_eventos where revision<>1 or maps_url<>'' or sc_escopo_id is not null or arquivado_em is not null) then
  raise exception 'Novos campos não correspondem ao estado inicial esperado';
 end if;
end;
$$;
select 'PASSOU: registros originais preservados; alteração será desfeita' as resultado;
select tipo,count(*) as registros_conferidos from sc_ensaio_antes group by tipo order by tipo;
rollback;
select 'ROLLBACK concluído: nenhum campo novo deve permanecer' as resultado,
 count(*) as campos_novos_restantes
from information_schema.columns
where table_schema='public' and table_name='agenda_eventos'
and column_name in ('revision','maps_url','sc_escopo_id','arquivado_em');
