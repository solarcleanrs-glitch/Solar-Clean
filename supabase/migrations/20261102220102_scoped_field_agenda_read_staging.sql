-- STAGING ONLY. Additive read path; existing app/policies are not replaced.
-- Production requires legacy-schema review and a coordinated app/RLS cutover.
create schema sc_private;
revoke all on schema sc_private from public, anon, authenticated;
grant usage on schema sc_private to authenticated;

-- A privileged projection is necessary: field users must not read payment or
-- internal-note columns through the source table. No caller-controlled user ID.
create function sc_private.agenda_campo(
  p_inicio date, p_fim date, p_unidade text default null
) returns table (
  id text, cliente text, telefone text, cidade text, endereco text,
  maps_url text, placas integer, unidade text, data date, hora time,
  duracao_min integer, tecnico text, status text
)
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  access_role text;
  partner uuid;
begin
  if actor is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;
  if p_inicio is null or p_fim is null or p_fim < p_inicio
     or p_fim - p_inicio > 92
     or (p_unidade is not null and p_unidade not in ('RS', 'SC')) then
    raise exception 'Informe período de até 93 dias e unidade válida'
      using errcode = '22023';
  end if;
  select a.papel, a.parceiro_id into access_role, partner
  from public.sc_acessos a
  join public.crm_usuarios u on u.user_id = a.user_id
  where a.user_id = actor and a.ativo;
  if access_role is null or access_role not in ('gestor', 'tecnico', 'parceiro') then
    raise exception 'Acesso operacional não autorizado' using errcode = '42501';
  end if;
  return query
  select e.id::text, e.cliente, e.telefone, e.cidade, e.endereco,
         e.maps_url, e.placas, e.unidade, e.data, e.hora,
         e.duracao_min, e.tecnico, e.status
  from public.agenda_eventos e
  where e.arquivado_em is null
    and e.data between p_inicio and p_fim
    and (p_unidade is null or e.unidade = p_unidade)
    and (
      access_role = 'gestor'
      or (
        exists (select 1 from public.sc_acesso_unidades au
                where au.user_id = actor and au.unidade = e.unidade)
        and exists (
          select 1 from public.sc_clientes_escopos s
          where s.id = e.sc_escopo_id and s.unidade = e.unidade
            and (access_role = 'tecnico' or (
              access_role = 'parceiro' and partner = s.parceiro_id
              and exists (select 1 from public.sc_parceiros p
                          where p.id = partner and p.ativo)
            ))
        )
      )
    )
  order by e.data, e.hora, e.id;
end;
$$;
revoke all on function sc_private.agenda_campo(date,date,text)
  from public, anon, authenticated;
grant execute on function sc_private.agenda_campo(date,date,text) to authenticated;

-- Only this invoker wrapper belongs to the exposed API schema.
create function public.sc_agenda_campo(
  p_inicio date, p_fim date, p_unidade text default null
) returns table (
  id text, cliente text, telefone text, cidade text, endereco text,
  maps_url text, placas integer, unidade text, data date, hora time,
  duracao_min integer, tecnico text, status text
)
language sql stable security invoker set search_path = '' as $$
  select * from sc_private.agenda_campo(p_inicio,p_fim,p_unidade);
$$;
revoke all on function public.sc_agenda_campo(date,date,text)
  from public, anon, authenticated;
grant execute on function public.sc_agenda_campo(date,date,text) to authenticated;
