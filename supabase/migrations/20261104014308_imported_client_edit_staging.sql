-- STAGING ONLY. Manager edits with immutable origins and exact-attempt retry.
alter table public.sc_clientes add column status_comercial text not null default 'Em conferência'
 check(status_comercial in ('Em conferência','Ativo','Recorrência pendente','Recuperação','Inativo','Não contatar'));
create table sc_private.cliente_edicoes(
 id uuid primary key,cliente_id uuid not null references public.sc_clientes(id),
 criado_por uuid not null,created_at timestamptz not null default now(),
 revisao_anterior integer not null,dados jsonb not null,antes jsonb not null,depois jsonb not null
);
create index cliente_edicoes_cliente_idx on sc_private.cliente_edicoes(cliente_id,created_at desc,id);
alter table sc_private.cliente_edicoes enable row level security;
revoke all on sc_private.cliente_edicoes from public,anon,authenticated;

create function sc_private.cliente_edicao(p_cliente uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not coalesce(public.sc_is_manager(),false)
 or not exists(select 1 from public.crm_usuarios where user_id=auth.uid()) then
 raise exception 'Edição restrita ao gestor ativo' using errcode='42501';end if;
 select jsonb_build_object('id',c.id,'revision',c.revision,'cliente',c.cliente,
 'telefone',c.telefone,'cidade',c.cidade,'endereco',c.endereco,'status_comercial',c.status_comercial)
 into result from public.sc_clientes c where c.id=p_cliente;
 if result is null then raise exception 'Cliente não encontrado' using errcode='22023';end if;
 return result;
end $$;
revoke all on function sc_private.cliente_edicao(uuid) from public,anon,authenticated;
grant execute on function sc_private.cliente_edicao(uuid) to authenticated;
create function public.sc_cliente_edicao(p_cliente uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select sc_private.cliente_edicao(p_cliente)$$;
revoke all on function public.sc_cliente_edicao(uuid) from public,anon,authenticated;
grant execute on function public.sc_cliente_edicao(uuid) to authenticated;

create function sc_private.editar_cliente(p_id uuid,p_cliente uuid,p_revision integer,p_dados jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare old public.sc_clientes%rowtype;prior sc_private.cliente_edicoes%rowtype;
 before_data jsonb;after_data jsonb;actor uuid:=auth.uid();
begin
 if actor is null or not coalesce(public.sc_is_manager(),false)
 or not exists(select 1 from public.crm_usuarios where user_id=actor) then
 raise exception 'Edição restrita ao gestor ativo' using errcode='42501';end if;
 if p_id is null or p_cliente is null or p_revision is null or p_revision<1
 or jsonb_typeof(p_dados) is distinct from 'object' then
 raise exception 'Dados inválidos' using errcode='22023';end if;
 if (select count(*) from jsonb_object_keys(p_dados))<>5
 or exists(select 1 from jsonb_each(p_dados) e where e.key not in
 ('cliente','telefone','cidade','endereco','status_comercial') or jsonb_typeof(e.value)<>'string')
 or length(btrim(p_dados->>'cliente')) not between 1 and 200
 or length(p_dados->>'cidade')>200 or length(p_dados->>'endereco')>1000
 or (p_dados->>'telefone'<>'' and p_dados->>'telefone' !~ '^[+]55[0-9]{10,11}$')
 or p_dados->>'status_comercial' not in ('Em conferência','Ativo','Recorrência pendente','Recuperação','Inativo','Não contatar')
 then raise exception 'Campos inválidos' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,9));
 select * into prior from sc_private.cliente_edicoes where id=p_id;
 if found then
 if prior.cliente_id<>p_cliente or prior.criado_por<>actor or prior.revisao_anterior<>p_revision
 or prior.dados<>p_dados then raise exception 'Tentativa com outros dados' using errcode='22023';end if;
 return jsonb_build_object('id',p_id,'cliente_id',p_cliente,'revision',p_revision+1,'repetido',true);
 end if;
 select * into old from public.sc_clientes where id=p_cliente for update;
 if not found then raise exception 'Cliente não encontrado' using errcode='22023';end if;
 if old.revision<>p_revision then raise exception 'Cadastro alterado. Consulte novamente.' using errcode='40001';end if;
 before_data:=sc_private.cliente_edicao(p_cliente);
 update public.sc_clientes set cliente=btrim(p_dados->>'cliente'),telefone=p_dados->>'telefone',
 cidade=p_dados->>'cidade',endereco=p_dados->>'endereco',status_comercial=p_dados->>'status_comercial',
 revision=revision+1 where id=p_cliente;
 after_data:=sc_private.cliente_edicao(p_cliente);
 insert into sc_private.cliente_edicoes(id,cliente_id,criado_por,revisao_anterior,dados,antes,depois)
 values(p_id,p_cliente,actor,p_revision,p_dados,before_data,after_data);
 return jsonb_build_object('id',p_id,'cliente_id',p_cliente,'revision',p_revision+1,'repetido',false);
end $$;
revoke all on function sc_private.editar_cliente(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function sc_private.editar_cliente(uuid,uuid,integer,jsonb) to authenticated;
create function public.sc_editar_cliente(p_id uuid,p_cliente uuid,p_revision integer,p_dados jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select sc_private.editar_cliente(p_id,p_cliente,p_revision,p_dados);
$$;
revoke all on function public.sc_editar_cliente(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.sc_editar_cliente(uuid,uuid,integer,jsonb) to authenticated;

create function sc_private.historico_edicoes_cliente(p_cliente uuid)
returns table(id uuid,created_at timestamptz,antes jsonb,depois jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
 perform sc_private.cliente_edicao(p_cliente);
 return query select e.id,e.created_at,e.antes,e.depois from sc_private.cliente_edicoes e
 where e.cliente_id=p_cliente order by e.created_at desc,e.id;
end $$;
revoke all on function sc_private.historico_edicoes_cliente(uuid) from public,anon,authenticated;
grant execute on function sc_private.historico_edicoes_cliente(uuid) to authenticated;
create function public.sc_historico_edicoes_cliente(p_cliente uuid)
returns table(id uuid,created_at timestamptz,antes jsonb,depois jsonb)
language sql stable security invoker set search_path='' as $$
 select * from sc_private.historico_edicoes_cliente(p_cliente);
$$;
revoke all on function public.sc_historico_edicoes_cliente(uuid) from public,anon,authenticated;
grant execute on function public.sc_historico_edicoes_cliente(uuid) to authenticated;
create or replace function sc_private.registrar_contato_cliente(p_id uuid,p_cliente uuid,p_resultado text,p_observacao text,p_retorno date default null)
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
 -- Same row lock as editing: a concurrent opt-out cannot be ignored.
 perform 1 from public.sc_clientes where id=p_cliente for share;
 if exists(select 1 from public.sc_clientes where id=p_cliente and status_comercial='Não contatar') then
  raise exception 'Cliente marcado como Não contatar. Revise o cadastro antes de novo contato.' using errcode='42501';end if;
 insert into sc_private.cliente_contatos(id,cliente_id,criado_por,resultado,observacao,retorno)
 values(p_id,p_cliente,actor,p_resultado,p_observacao,p_retorno);
 return jsonb_build_object('id',p_id,'repetido',false);
end $$;
