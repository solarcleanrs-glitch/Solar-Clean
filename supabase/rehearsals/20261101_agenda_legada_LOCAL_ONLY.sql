-- ENSAIO LOCAL SOMENTE. Não aplicar no Supabase oficial nem no staging ativo.
-- Etapa estrutural isolada; não é pacote de implantação, autenticação ou RLS.
-- Não infere unidade/parceiro; não converte IDs e não altera campos legados.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='agenda_eventos'
      and column_name='id' and data_type='text'
  ) then
    raise exception 'Ensaio exige agenda legada com id text';
  end if;
end;
$$;
alter table public.agenda_eventos
  add column revision bigint not null default 1 check (revision >= 1),
  add column maps_url text not null default '',
  add column sc_escopo_id uuid,
  add column arquivado_em timestamptz;
-- Sem FK de escopo nesta etapa: fundação de acesso ainda não instalada.
-- Sem trigger de revisão: exige implantação coordenada do cliente e CAS.
-- Reexecução falha e reverte a transação em vez de aceitar schema desconhecido.
commit;
