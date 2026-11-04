-- STAGING ONLY. Immutable manager contact log for imported clients.
create table sc_private.cliente_contatos(
 id uuid primary key,
 cliente_id uuid not null references public.sc_clientes(id),
 criado_por uuid not null,
 created_at timestamptz not null default now(),
 resultado text not null check(resultado in ('Tentativa sem resposta','Cliente respondeu','Orçamento solicitado','Agendamento combinado','Retornar mais tarde','Não deseja contato')),
 observacao text not null default '' check(length(observacao)<=2000),
 retorno date
);
create index cliente_contatos_cliente_data_idx on sc_private.cliente_contatos(cliente_id,created_at desc,id);
alter table sc_private.cliente_contatos enable row level security;
revoke all on sc_private.cliente_contatos from public,anon,authenticated;

create function public.sc_pode_registrar_contato_cliente() returns boolean
language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and public.sc_is_manager()
  and exists(select 1 from public.crm_usuarios u where u.user_id=auth.uid());
$$;
revoke all on function public.sc_pode_registrar_contato_cliente() from public,anon,authenticated;
grant execute on function public.sc_pode_registrar_contato_cliente() to authenticated;

create function sc_private.registrar_contato_cliente(p_id uuid,p_cliente uuid,p_resultado text,p_observacao text,p_retorno date default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();previous sc_private.cliente_contatos%rowtype;
begin
 if not coalesce(public.sc_pode_registrar_contato_cliente(),false) then
  raise exception 'Registro de contato restrito ao gestor ativo' using errcode='42501';end if;
 if p_id is null or p_cliente is null or p_resultado is null or p_resultado not in
  ('Tentativa sem resposta','Cliente respondeu','Orçamento solicitado','Agendamento combinado','Retornar mais tarde','Não deseja contato')
  or p_observacao is null or length(p_observacao)>2000 then
  raise exception 'Dados do contato inválidos' using errcode='22023';end if;
 if not exists(select 1 from public.sc_clientes c where c.id=p_cliente) then
  raise exception 'Cliente importado não encontrado' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,8));
 select * into previous from sc_private.cliente_contatos where id=p_id;
 if found then
  if previous.cliente_id<>p_cliente or previous.criado_por<>actor or previous.resultado<>p_resultado
   or previous.observacao<>p_observacao or previous.retorno is distinct from p_retorno then
   raise exception 'Identificador de contato já utilizado com outros dados' using errcode='22023';end if;
  return jsonb_build_object('id',previous.id,'repetido',true);
 end if;
 insert into sc_private.cliente_contatos(id,cliente_id,criado_por,resultado,observacao,retorno)
 values(p_id,p_cliente,actor,p_resultado,p_observacao,p_retorno);
 return jsonb_build_object('id',p_id,'repetido',false);
end $$;
revoke all on function sc_private.registrar_contato_cliente(uuid,uuid,text,text,date) from public,anon,authenticated;
grant execute on function sc_private.registrar_contato_cliente(uuid,uuid,text,text,date) to authenticated;
create function public.sc_registrar_contato_cliente(p_id uuid,p_cliente uuid,p_resultado text,p_observacao text,p_retorno date default null)
returns jsonb language sql security invoker set search_path='' as $$
 select sc_private.registrar_contato_cliente(p_id,p_cliente,p_resultado,p_observacao,p_retorno);
$$;
revoke all on function public.sc_registrar_contato_cliente(uuid,uuid,text,text,date) from public,anon,authenticated;
grant execute on function public.sc_registrar_contato_cliente(uuid,uuid,text,text,date) to authenticated;

create function sc_private.historico_contatos_cliente(p_cliente uuid)
returns table(id uuid,created_at timestamptz,resultado text,observacao text,retorno date)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce(public.sc_pode_registrar_contato_cliente(),false) then
  raise exception 'Histórico de contato restrito ao gestor ativo' using errcode='42501';end if;
 return query select c.id,c.created_at,c.resultado,c.observacao,c.retorno
 from sc_private.cliente_contatos c where c.cliente_id=p_cliente order by c.created_at desc,c.id;
end $$;
revoke all on function sc_private.historico_contatos_cliente(uuid) from public,anon,authenticated;
grant execute on function sc_private.historico_contatos_cliente(uuid) to authenticated;
create function public.sc_historico_contatos_cliente(p_cliente uuid)
returns table(id uuid,created_at timestamptz,resultado text,observacao text,retorno date)
language sql stable security invoker set search_path='' as $$
 select * from sc_private.historico_contatos_cliente(p_cliente);
$$;
revoke all on function public.sc_historico_contatos_cliente(uuid) from public,anon,authenticated;
grant execute on function public.sc_historico_contatos_cliente(uuid) to authenticated;
