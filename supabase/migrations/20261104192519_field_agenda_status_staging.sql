-- STAGING ONLY: zzphucuiqhzrilrddxnf. No production deployment or account activation.
-- Existing table policies stay unchanged; only an authorized status transition is exposed.
create table sc_private.agenda_status_eventos (
  id uuid primary key,
  agendamento_id text not null,
  criado_por uuid not null,
  revision_antes bigint not null check (revision_antes > 0),
  revision_depois bigint not null check (revision_depois = revision_antes + 1),
  status_antes text not null,
  status_depois text not null,
  created_at timestamptz not null default now()
);
alter table sc_private.agenda_status_eventos enable row level security;
revoke all on sc_private.agenda_status_eventos from public, anon, authenticated;

create function sc_private.pode_avancar_status_campo() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.sc_acessos a join public.crm_usuarios u on u.user_id=a.user_id
    where a.user_id=auth.uid() and a.ativo and a.papel in ('gestor','tecnico')
  );
$$;
revoke all on function sc_private.pode_avancar_status_campo() from public, anon, authenticated;
grant execute on function sc_private.pode_avancar_status_campo() to authenticated;

create function sc_private.agenda_status_autorizada(p_agendamento text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.agenda_eventos e
    join public.sc_acessos a on a.user_id=auth.uid() and a.ativo
    join public.crm_usuarios u on u.user_id=a.user_id
    where e.id::text=p_agendamento and e.arquivado_em is null and (
      a.papel='gestor' or (a.papel='tecnico'
        and exists (select 1 from public.sc_acesso_unidades au
                    where au.user_id=a.user_id and au.unidade=e.unidade)
        and exists (select 1 from public.sc_clientes_escopos s
                    where s.id=e.sc_escopo_id and s.unidade=e.unidade)
      )
    )
  );
$$;
revoke all on function sc_private.agenda_status_autorizada(text) from public, anon, authenticated;

create function sc_private.agenda_status_campo(p_agendamento text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not sc_private.agenda_status_autorizada(p_agendamento) then
    raise exception 'Atendimento indisponível para atualização nesta conta' using errcode='42501';
  end if;
  return (select jsonb_build_object('id',e.id::text,'revision',e.revision,'status',e.status,
    'proximo_status',case e.status when 'Agendado' then 'Em deslocamento'
      when 'Em deslocamento' then 'Em atendimento' when 'Em atendimento' then 'Concluído' else null end)
    from public.agenda_eventos e where e.id::text=p_agendamento);
end;
$$;
revoke all on function sc_private.agenda_status_campo(text) from public, anon, authenticated;
grant execute on function sc_private.agenda_status_campo(text) to authenticated;

create function sc_private.avancar_status_campo(p_id uuid,p_agendamento text,p_revision bigint,p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid:=auth.uid(); e record; previous sc_private.agenda_status_eventos%rowtype;
  next_status text; old_status text;
begin
  if actor is null or not sc_private.agenda_status_autorizada(p_agendamento) then
    raise exception 'Atendimento indisponível para atualização nesta conta' using errcode='42501';
  end if;
  if p_id is null or p_agendamento is null or length(btrim(p_agendamento))=0
     or length(p_agendamento)>512 or p_revision is null or p_revision<1
     or p_revision>9007199254740990 or p_status is null
     or p_status not in ('Em deslocamento','Em atendimento','Concluído') then
    raise exception 'Tentativa de atualização inválida' using errcode='22023';
  end if;
  select a.id::text as id,a.revision,a.status into e from public.agenda_eventos a
    where a.id::text=p_agendamento for update;
  if not found or not sc_private.agenda_status_autorizada(p_agendamento) then
    raise exception 'Atendimento indisponível para atualização nesta conta' using errcode='42501';
  end if;
  select * into previous from sc_private.agenda_status_eventos where id=p_id;
  if found then
    if previous.criado_por<>actor or previous.agendamento_id<>p_agendamento
       or previous.revision_antes<>p_revision or previous.status_depois<>p_status then
      raise exception 'Identificador de tentativa já usado com outro conteúdo' using errcode='22023';
    end if;
    return jsonb_build_object('id',p_id,'agendamento_id',p_agendamento,
      'revision',previous.revision_depois,'status',previous.status_depois,'repetido',true,
      'estado_atual',sc_private.agenda_status_campo(p_agendamento));
  end if;
  if e.revision<>p_revision then
    raise exception 'Atendimento alterado; consulte a situação atual antes de confirmar' using errcode='40001';
  end if;
  next_status:=case e.status when 'Agendado' then 'Em deslocamento'
    when 'Em deslocamento' then 'Em atendimento' when 'Em atendimento' then 'Concluído' else null end;
  if next_status is null or p_status<>next_status then
    raise exception 'Avanço de status não permitido' using errcode='22023';
  end if;
  old_status:=e.status;
  update public.agenda_eventos a set status=p_status
    where a.id::text=p_agendamento and a.revision=p_revision and a.arquivado_em is null
    returning a.id::text as id,a.revision,a.status into e;
  if not found or e.revision<>p_revision+1 then
    raise exception 'Revisão de atendimento não confirmada' using errcode='40001';
  end if;
  insert into sc_private.agenda_status_eventos
    (id,agendamento_id,criado_por,revision_antes,revision_depois,status_antes,status_depois)
    values(p_id,p_agendamento,actor,p_revision,e.revision,old_status,e.status);
  return jsonb_build_object('id',p_id,'agendamento_id',p_agendamento,
    'revision',e.revision,'status',e.status,'repetido',false,
    'estado_atual',sc_private.agenda_status_campo(p_agendamento));
end;
$$;
revoke all on function sc_private.avancar_status_campo(uuid,text,bigint,text) from public, anon, authenticated;
grant execute on function sc_private.avancar_status_campo(uuid,text,bigint,text) to authenticated;

create function public.sc_pode_avancar_status_campo() returns boolean
language sql stable security invoker set search_path = '' as $$
  select sc_private.pode_avancar_status_campo();
$$;
create function public.sc_agenda_status_campo(p_agendamento text) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select sc_private.agenda_status_campo(p_agendamento);
$$;
create function public.sc_avancar_status_campo(p_id uuid,p_agendamento text,p_revision bigint,p_status text)
returns jsonb language sql volatile security invoker set search_path = '' as $$
  select sc_private.avancar_status_campo(p_id,p_agendamento,p_revision,p_status);
$$;
revoke all on function public.sc_pode_avancar_status_campo() from public, anon, authenticated;
revoke all on function public.sc_agenda_status_campo(text) from public, anon, authenticated;
revoke all on function public.sc_avancar_status_campo(uuid,text,bigint,text) from public, anon, authenticated;
grant execute on function public.sc_pode_avancar_status_campo() to authenticated;
grant execute on function public.sc_agenda_status_campo(text) to authenticated;
grant execute on function public.sc_avancar_status_campo(uuid,text,bigint,text) to authenticated;
