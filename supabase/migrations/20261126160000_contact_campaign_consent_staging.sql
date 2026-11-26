-- Campaign consent for CRM staging. Historical customers start without consent.
begin;

create table sc_private.contact_campaign_consent (
  id bigint generated always as identity primary key,
  cliente_id uuid not null references public.sc_clientes(id),
  unidade text not null check (unidade in ('RS', 'SC')),
  telefone text not null check (telefone ~ '^\+55[0-9]{10,11}$'),
  autorizado boolean not null,
  origem text not null check (length(btrim(origem)) between 1 and 200),
  registrado_por uuid not null,
  registrado_em timestamptz not null default now()
);

create index contact_campaign_consent_latest
  on sc_private.contact_campaign_consent (cliente_id, id desc);

alter table sc_private.contact_campaign_consent enable row level security;
revoke all on sc_private.contact_campaign_consent from public, anon, authenticated;

create function sc_private.record_contact_campaign_consent(
  p_cliente_id uuid, p_autorizado boolean, p_origem text
)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  customer public.sc_clientes%rowtype;
  event_id bigint;
begin
  if actor is null or p_autorizado is null
    or p_origem is null or length(btrim(p_origem)) not between 1 and 200 then
    raise exception 'Autorização ou origem inválida' using errcode = '22023';
  end if;

  select c.* into customer
  from public.sc_clientes c
  join public.sc_acesso_unidades u on u.unidade = c.unidade and u.user_id = actor
  join public.sc_acessos a on a.user_id = u.user_id and a.ativo and a.papel = 'gestor'
  where c.id = p_cliente_id
  for update of c;

  if not found then
    raise exception 'Cliente indisponível para este gestor' using errcode = '42501';
  end if;

  if not p_autorizado then
    -- Revocation stays possible after a phone edit. Preserve the last recorded number.
    select telefone into customer.telefone
    from sc_private.contact_campaign_consent
    where cliente_id = customer.id
    order by id desc limit 1;
    if not found then
      return null;
    end if;
  elsif customer.telefone is null or customer.telefone !~ '^\+55[0-9]{10,11}$'
    or lower(btrim(customer.status_comercial)) = 'não contatar' then
    raise exception 'O contato está bloqueado ou tem telefone inválido' using errcode = '22023';
  end if;

  insert into sc_private.contact_campaign_consent
    (cliente_id, unidade, telefone, autorizado, origem, registrado_por)
  values
    (customer.id, customer.unidade, customer.telefone, p_autorizado, btrim(p_origem), actor)
  returning id into event_id;
  return event_id;
end;
$$;

create function public.sc_registrar_autorizacao_campanha(
  p_cliente_id uuid, p_autorizado boolean, p_origem text
)
returns bigint
language sql security invoker set search_path = ''
as $$
  select sc_private.record_contact_campaign_consent(p_cliente_id, p_autorizado, p_origem);
$$;

revoke all on function sc_private.record_contact_campaign_consent(uuid, boolean, text)
  from public, anon, authenticated;
revoke all on function public.sc_registrar_autorizacao_campanha(uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function sc_private.record_contact_campaign_consent(uuid, boolean, text)
  to authenticated;
grant execute on function public.sc_registrar_autorizacao_campanha(uuid, boolean, text)
  to authenticated;

commit;
