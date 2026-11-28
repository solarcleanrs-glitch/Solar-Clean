begin;

create or replace function sc_private.contact_campaign_export()
returns table (
  id uuid, cliente text, cidade text, telefone text, unidade text,
  ultima_limpeza date, autorizacao boolean, status_comercial text
)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.cliente, c.cidade, c.telefone, c.unidade,
    last_service.data,
    coalesce(e.autorizado and e.telefone = c.telefone and e.unidade = c.unidade, false)
      and lower(btrim(coalesce(c.status_comercial, ''))) <> 'não contatar'
      and not exists (
        select 1 from public.sc_clientes duplicate
        where duplicate.telefone = c.telefone and duplicate.id <> c.id
      ),
    c.status_comercial
  from public.sc_clientes c
  join public.sc_acesso_unidades u on u.unidade = c.unidade and u.user_id = auth.uid()
  join public.sc_acessos a on a.user_id = u.user_id and a.papel = 'gestor' and a.ativo
  left join lateral (
    select h.autorizado, h.telefone, h.unidade
    from sc_private.contact_campaign_consent h
    where h.cliente_id = c.id
    order by h.id desc limit 1
  ) e on true
  left join lateral (
    select max(agenda.data) as data
    from public.sc_cliente_origens_google origem
    join public.agenda_eventos agenda on agenda.google_event_id = origem.evento_google
    where origem.cliente_id = c.id
      and agenda.unidade = c.unidade
      and agenda.status = 'Concluído'
      and agenda.arquivado_em is null
      and agenda.data <= (now() at time zone 'America/Sao_Paulo')::date
      -- Agenda stores the event ID without calendar identity. Ignore ambiguous IDs.
      and not exists (
        select 1 from public.sc_cliente_origens_google outra
        where outra.evento_google = origem.evento_google
          and outra.agenda_google <> origem.agenda_google
      )
  ) last_service on true
  where c.telefone <> '';
$$;


commit;
