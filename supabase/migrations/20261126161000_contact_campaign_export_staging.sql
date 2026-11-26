begin;

-- All duplicates are withheld until ownership of the number is resolved.
-- Historical events without a verified customer link have no cleaning date.
create function sc_private.contact_campaign_export()
returns table (
  id uuid, cliente text, cidade text, telefone text, unidade text,
  ultima_limpeza date, autorizacao boolean, status_comercial text
)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.cliente, c.cidade, c.telefone, c.unidade,
    null::date,
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
  where c.telefone <> '';
$$;

revoke all on function sc_private.contact_campaign_export() from public, anon, authenticated;
grant execute on function sc_private.contact_campaign_export() to authenticated;

create view public.crm_export_contacts with (security_invoker = true) as
  select * from sc_private.contact_campaign_export();

revoke all on public.crm_export_contacts from public, anon, authenticated;
grant select on public.crm_export_contacts to authenticated;

commit;
