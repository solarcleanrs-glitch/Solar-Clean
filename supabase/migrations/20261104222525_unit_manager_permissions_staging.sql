-- CANDIDATE, NOT APPLIED. Staging only. Does not create/activate any identity.
-- Deploy only with account-scoped local storage and the corresponding client.
begin;
alter table public.sc_acessos drop constraint sc_acessos_papel_check;
alter table public.sc_acessos add constraint sc_acessos_papel_check
 check(papel in ('gestor','gestor_unidade','tecnico','financeiro','parceiro'));

-- The old global manager remains global. Never assign that role to an RS-only manager.
create function sc_private.sc_pode_administrar_unidade() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.sc_acessos a
 join public.crm_usuarios c on c.user_id=a.user_id where a.user_id=auth.uid() and a.ativo
 and (a.papel='gestor' or (a.papel='gestor_unidade' and exists(
  select 1 from public.sc_acesso_unidades u where u.user_id=a.user_id))));
$$;
revoke all on function sc_private.sc_pode_administrar_unidade() from public,anon,authenticated;
grant execute on function sc_private.sc_pode_administrar_unidade() to authenticated;
create function public.sc_pode_administrar_unidade() returns boolean language sql stable security invoker set search_path='' as $$select sc_private.sc_pode_administrar_unidade()$$;
create function sc_private.sc_pode_gerir_unidade(p_unidade text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.sc_acessos a
 join public.crm_usuarios c on c.user_id=a.user_id where a.user_id=auth.uid() and a.ativo
 and (a.papel='gestor' or (a.papel='gestor_unidade' and p_unidade in ('RS','SC') and exists(
  select 1 from public.sc_acesso_unidades u where u.user_id=a.user_id and u.unidade=p_unidade))));
$$;
revoke all on function sc_private.sc_pode_gerir_unidade(text) from public,anon,authenticated;
grant execute on function sc_private.sc_pode_gerir_unidade(text) to authenticated;
create function public.sc_pode_gerir_unidade(p_unidade text) returns boolean language sql stable security invoker set search_path='' as $$select sc_private.sc_pode_gerir_unidade(p_unidade)$$;
create function sc_private.sc_pode_gerir_escopo(p_escopo uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select (public.sc_is_manager() and public.sc_pode_administrar_unidade()) or exists(
  select 1 from public.sc_clientes_escopos s where s.id=p_escopo and public.sc_pode_gerir_unidade(s.unidade));
$$;
revoke all on function sc_private.sc_pode_gerir_escopo(uuid) from public,anon,authenticated;
grant execute on function sc_private.sc_pode_gerir_escopo(uuid) to authenticated;
create function public.sc_pode_gerir_escopo(p_escopo uuid) returns boolean language sql stable security invoker set search_path='' as $$select sc_private.sc_pode_gerir_escopo(p_escopo)$$;
create function sc_private.sc_pode_gerir_cliente(p_cliente uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select (public.sc_is_manager() and public.sc_pode_administrar_unidade()) or exists(
  select 1 from public.sc_clientes c where c.id=p_cliente and public.sc_pode_gerir_unidade(c.unidade));
$$;
revoke all on function sc_private.sc_pode_gerir_cliente(uuid) from public,anon,authenticated;
grant execute on function sc_private.sc_pode_gerir_cliente(uuid) to authenticated;
create function public.sc_pode_gerir_cliente(p_cliente uuid) returns boolean language sql stable security invoker set search_path='' as $$select sc_private.sc_pode_gerir_cliente(p_cliente)$$;
create function sc_private.sc_pode_gerir_fechamento(p_fechamento uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select (public.sc_is_manager() and public.sc_pode_administrar_unidade()) or exists(
  select 1 from public.sc_fechamentos f where f.id=p_fechamento and public.sc_pode_gerir_unidade(f.unidade));
$$;
revoke all on function sc_private.sc_pode_gerir_fechamento(uuid) from public,anon,authenticated;
grant execute on function sc_private.sc_pode_gerir_fechamento(uuid) to authenticated;
create function public.sc_pode_gerir_fechamento(p_fechamento uuid) returns boolean language sql stable security invoker set search_path='' as $$select sc_private.sc_pode_gerir_fechamento(p_fechamento)$$;
create function sc_private.sc_pode_gerir_chave_legada(p_key text) returns boolean
language sql stable security definer set search_path='' as $$
 select (public.sc_is_manager() and public.sc_pode_administrar_unidade()) or (
  exists(select 1 from public.sc_clientes_escopos s where s.legacy_client_key=p_key
    and public.sc_pode_gerir_unidade(s.unidade))
  and not exists(select 1 from public.sc_clientes_escopos s where s.legacy_client_key=p_key
    and not public.sc_pode_gerir_unidade(s.unidade)));
$$;
revoke all on function sc_private.sc_pode_gerir_chave_legada(text) from public,anon,authenticated;
grant execute on function sc_private.sc_pode_gerir_chave_legada(text) to authenticated;
create function public.sc_pode_gerir_chave_legada(p_key text) returns boolean language sql stable security invoker set search_path='' as $$select sc_private.sc_pode_gerir_chave_legada(p_key)$$;
create function sc_private.sc_pode_importar_cliente(p_cliente uuid,p_agenda text,p_evento text,p_cadastro jsonb)
returns boolean language sql stable security definer set search_path='' as $$
 select public.sc_pode_gerir_unidade(p_cadastro->>'unidade')
 and not exists(select 1 from public.sc_clientes c where c.id=p_cliente and not public.sc_pode_gerir_unidade(c.unidade))
 and not exists(select 1 from public.sc_cliente_origens_google o join public.sc_clientes c on c.id=o.cliente_id
  where o.agenda_google=p_agenda and o.evento_google=p_evento and not public.sc_pode_gerir_unidade(c.unidade));
$$;
revoke all on function sc_private.sc_pode_importar_cliente(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function sc_private.sc_pode_importar_cliente(uuid,text,text,jsonb) to authenticated;
create function public.sc_pode_importar_cliente(p_cliente uuid,p_agenda text,p_evento text,p_cadastro jsonb) returns boolean language sql stable security invoker set search_path='' as $$select sc_private.sc_pode_importar_cliente(p_cliente,p_agenda,p_evento,p_cadastro)$$;
revoke all on function public.sc_pode_administrar_unidade(),public.sc_pode_gerir_unidade(text),
 public.sc_pode_gerir_escopo(uuid),public.sc_pode_gerir_cliente(uuid),public.sc_pode_gerir_fechamento(uuid),
 public.sc_pode_gerir_chave_legada(text),public.sc_pode_importar_cliente(uuid,text,text,jsonb)
 from public,anon,authenticated;
grant execute on function public.sc_pode_administrar_unidade(),public.sc_pode_gerir_unidade(text),
 public.sc_pode_gerir_escopo(uuid),public.sc_pode_gerir_cliente(uuid),public.sc_pode_gerir_fechamento(uuid),
 public.sc_pode_gerir_chave_legada(text),public.sc_pode_importar_cliente(uuid,text,text,jsonb) to authenticated;

-- Additive policies: no access-management policy is widened for the scoped role.
create policy sc_agenda_gestor_unidade on public.agenda_eventos for all to authenticated
 using(public.sc_pode_gerir_unidade(unidade)) with check(public.sc_pode_gerir_unidade(unidade));
create policy sc_escopos_gestor_unidade on public.sc_clientes_escopos for all to authenticated
 using(public.sc_pode_gerir_unidade(unidade)) with check(public.sc_pode_gerir_unidade(unidade));
create policy sc_parceiros_catalogo_unidade on public.sc_parceiros for select to authenticated
 using(public.sc_pode_administrar_unidade());
create policy sc_clientes_gestor_unidade on public.sc_clientes for select to authenticated
 using(public.sc_pode_gerir_unidade(unidade));
create policy sc_origens_gestor_unidade on public.sc_cliente_origens_google for select to authenticated
 using(public.sc_pode_gerir_cliente(cliente_id));
create policy sc_fechamentos_gestor_unidade on public.sc_fechamentos for select to authenticated
 using(public.sc_pode_gerir_unidade(unidade));
create policy sc_itens_gestor_unidade on public.sc_fechamento_itens for select to authenticated
 using(public.sc_pode_gerir_fechamento(fechamento_id));
create policy sc_recebimentos_gestor_unidade on public.sc_fechamento_recebimentos for select to authenticated
 using(public.sc_pode_gerir_fechamento(fechamento_id));

-- Every restrictive legacy guard must agree. Fail on an unexpected/missing policy.
alter policy sc_gestor_provisorio on public.vistorias
 using(public.sc_pode_gerir_escopo(sc_escopo_id)) with check(public.sc_pode_gerir_escopo(sc_escopo_id));
alter policy sc_vistorias_legacy_guard on public.vistorias
 using(public.sc_pode_gerir_escopo(sc_escopo_id)) with check(public.sc_pode_gerir_escopo(sc_escopo_id));
alter policy sc_gestor_provisorio on public.crm_perfis
 using(public.sc_pode_gerir_chave_legada(client_key)) with check(public.sc_pode_gerir_chave_legada(client_key));
alter policy sc_crm_perfis_legacy_guard on public.crm_perfis
 using(public.sc_pode_gerir_chave_legada(client_key)) with check(public.sc_pode_gerir_chave_legada(client_key));
alter policy sc_gestor_provisorio on public.crm_metadados
 using(public.sc_pode_gerir_chave_legada(client_key)) with check(public.sc_pode_gerir_chave_legada(client_key));
alter policy sc_crm_metadados_legacy_guard on public.crm_metadados
 using(public.sc_pode_gerir_chave_legada(client_key)) with check(public.sc_pode_gerir_chave_legada(client_key));
alter policy sc_gestor_provisorio on public.crm_contatos
 using(public.sc_pode_gerir_chave_legada(client_key)) with check(public.sc_pode_gerir_chave_legada(client_key));
alter policy sc_crm_contatos_legacy_guard on public.crm_contatos
 using(public.sc_pode_gerir_chave_legada(client_key)) with check(public.sc_pode_gerir_chave_legada(client_key));

-- Media is uploaded before the inspection row. Bind its UUID to a managed scope first.
create table sc_private.midias_gerencia(visit_id uuid primary key,escopo_id uuid not null references public.sc_clientes_escopos(id));
alter table sc_private.midias_gerencia enable row level security;
revoke all on sc_private.midias_gerencia from public,anon,authenticated;
create function sc_private.reservar_midia_gerencia(p_vistoria uuid,p_escopo uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_vistoria is null or p_escopo is null or not public.sc_pode_gerir_escopo(p_escopo) then
  raise exception 'Escopo de mídia não autorizado' using errcode='42501';end if;
 if exists(select 1 from public.vistorias v where v.client_uuid=p_vistoria and v.sc_escopo_id is distinct from p_escopo) then
  raise exception 'UUID de vistoria já vinculado a outro escopo' using errcode='42501';end if;
 if not exists(select 1 from public.vistorias where client_uuid=p_vistoria)
 and not exists(select 1 from sc_private.midias_gerencia where visit_id=p_vistoria)
 and exists(select 1 from storage.objects where bucket_id='vistoria-media' and split_part(name,'/',1)=p_vistoria::text) then
  raise exception 'Mídia sem escopo confirmado: revisão global necessária' using errcode='42501';end if;
 insert into sc_private.midias_gerencia values(p_vistoria,p_escopo) on conflict(visit_id) do nothing;
 if not exists(select 1 from sc_private.midias_gerencia m where m.visit_id=p_vistoria and m.escopo_id=p_escopo) then
  raise exception 'Reserva de mídia divergente' using errcode='42501';end if;
 return true;
end $$;
create function public.sc_reservar_midia_gerencia(p_vistoria uuid,p_escopo uuid) returns boolean
language sql security invoker set search_path='' as $$select sc_private.reservar_midia_gerencia(p_vistoria,p_escopo)$$;
revoke all on function sc_private.reservar_midia_gerencia(uuid,uuid),public.sc_reservar_midia_gerencia(uuid,uuid) from public,anon,authenticated;
grant execute on function sc_private.reservar_midia_gerencia(uuid,uuid),public.sc_reservar_midia_gerencia(uuid,uuid) to authenticated;
create function sc_private.midia_gerenciavel(p_name text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare owner_id uuid;
begin
 if public.sc_is_manager() and public.sc_pode_administrar_unidade() then return true;end if;
 if p_name is null or position('..' in p_name)>0 or split_part(p_name,'/',1) !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false;end if;
 owner_id:=split_part(p_name,'/',1)::uuid;
 -- An existing row takes priority over any earlier reservation.
 if exists(select 1 from public.vistorias where client_uuid=owner_id) then
  return exists(select 1 from public.vistorias v where v.client_uuid=owner_id and public.sc_pode_gerir_escopo(v.sc_escopo_id));end if;
 return exists(select 1 from sc_private.midias_gerencia m where m.visit_id=owner_id and public.sc_pode_gerir_escopo(m.escopo_id));
end $$;
revoke all on function sc_private.midia_gerenciavel(text) from public,anon,authenticated;
grant execute on function sc_private.midia_gerenciavel(text) to authenticated;
-- Prevent claiming orphan media by inserting a new inspection with its UUID.
create function sc_private.validar_reserva_gerencia() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if public.sc_is_manager() then return new;end if;
 if not public.sc_pode_gerir_escopo(new.sc_escopo_id) then
  raise exception 'Escopo não autorizado' using errcode='42501';end if;
 if TG_OP='UPDATE' and new.client_uuid=old.client_uuid and new.sc_escopo_id=old.sc_escopo_id then return new;end if;
 if not exists(select 1 from sc_private.midias_gerencia m where m.visit_id=new.client_uuid and m.escopo_id=new.sc_escopo_id) then
  raise exception 'Reserva de vistoria necessária' using errcode='42501';end if;
 return new;
end $$;
revoke all on function sc_private.validar_reserva_gerencia() from public,anon,authenticated;
create trigger sc_validar_reserva_gerencia before insert or update on public.vistorias
for each row execute function sc_private.validar_reserva_gerencia();
alter policy sc_vistoria_media_gestor_provisorio on storage.objects
 using(bucket_id<>'vistoria-media' or sc_private.midia_gerenciavel(name) or sc_private.report_photo_allowed(name))
 with check(bucket_id<>'vistoria-media' or sc_private.midia_gerenciavel(name));
alter policy sc_vistoria_media_legacy_guard on storage.objects
 using(bucket_id<>'vistoria-media' or sc_private.midia_gerenciavel(name) or sc_private.report_photo_allowed(name))
 with check(bucket_id<>'vistoria-media' or sc_private.midia_gerenciavel(name));
alter policy sc_vistoria_media_update_guard on storage.objects
 using(bucket_id<>'vistoria-media' or sc_private.midia_gerenciavel(name))
 with check(bucket_id<>'vistoria-media' or sc_private.midia_gerenciavel(name));
alter policy sc_vistoria_media_delete_guard on storage.objects
 using(bucket_id<>'vistoria-media' or sc_private.midia_gerenciavel(name));

-- Guard definer entry points as well as RLS; a policy alone cannot constrain them.
-- Trusted catalog definitions only. Exact single-occurrence checks reject source drift.
do $patch$
declare item record;definition text;old_token text;new_token text;patched text;
begin
 for item in select * from (values
  ('public.sc_criar_fechamento(uuid,uuid,text,date,jsonb)','public.sc_is_manager()','public.sc_pode_gerir_unidade(p_unidade)'),
  ('public.sc_registrar_recebimento(uuid,uuid,bigint,date,text)','public.sc_is_manager()','public.sc_pode_gerir_fechamento(p_fechamento)'),
  ('public.sc_cancelar_fechamento(uuid,text)','public.sc_is_manager()','public.sc_pode_gerir_fechamento(p_id)'),
  ('public.sc_importar_cliente_google(uuid,text,text,jsonb,jsonb,boolean)','public.sc_is_manager()','public.sc_pode_importar_cliente(p_cliente_id,p_agenda,p_evento,p_cadastro)'),
  ('public.sc_pode_registrar_contato_cliente()','public.sc_is_manager()','public.sc_pode_administrar_unidade()'),
  ('sc_private.registrar_contato_cliente(uuid,uuid,text,text,date)','public.sc_pode_registrar_contato_cliente()','public.sc_pode_gerir_cliente(p_cliente)'),
  ('sc_private.historico_contatos_cliente(uuid)','public.sc_pode_registrar_contato_cliente()','public.sc_pode_gerir_cliente(p_cliente)'),
  ('sc_private.cliente_edicao(uuid)','public.sc_is_manager()','public.sc_pode_gerir_cliente(p_cliente)'),
  ('sc_private.editar_cliente(uuid,uuid,integer,jsonb)','public.sc_is_manager()','public.sc_pode_gerir_cliente(p_cliente)')
 ) as changes(signature,old_text,new_text) loop
  definition:=pg_get_functiondef(item.signature::regprocedure);old_token:=item.old_text;new_token:=item.new_text;
  if (length(definition)-length(replace(definition,old_token,'')))/length(old_token)<>1 then
   raise exception 'Permission source drift: %',item.signature;end if;
  patched:=replace(definition,old_token,new_token);execute patched;
 end loop;
 for item in select * from (values
  ('sc_private.agenda_campo(date,date,text)','access_role', 'public.sc_pode_gerir_unidade(e.unidade)'),
  ('sc_private.relatorio_campo(uuid)','access_role','public.sc_pode_gerir_escopo(x.sc_escopo_id)'),
  ('sc_private.clientes_campo(text,text)','access_role','public.sc_pode_gerir_unidade(c.unidade)')
 ) as projections(signature,role_var,guard) loop
  definition:=pg_get_functiondef(item.signature::regprocedure);
  patched:=regexp_replace(definition,$re$'gestor'\s*,\s*'tecnico'\s*,\s*'parceiro'$re$,$new$'gestor','gestor_unidade','tecnico','parceiro'$new$,'g');
  patched:=regexp_replace(patched,$re$access_role\s*=\s*'gestor'$re$,'(access_role=''gestor'' or (access_role=''gestor_unidade'' and '||item.guard||'))','g');
  if definition=patched or position('gestor_unidade' in patched)=0 then raise exception 'Projection source drift: %',item.signature;end if;
  execute patched;
 end loop;
 definition:=pg_get_functiondef('sc_private.relatorios_campo(date,date,text)'::regprocedure);
 patched:=regexp_replace(definition,$re$'gestor'\s*,\s*'tecnico'\s*,\s*'parceiro'$re$,$new$'gestor','gestor_unidade','tecnico','parceiro'$new$,'g');
 if definition=patched then raise exception 'Report list source drift';end if;execute patched;
 definition:=pg_get_functiondef('sc_private.pode_avancar_status_campo()'::regprocedure);
 patched:=regexp_replace(definition,$re$'gestor'\s*,\s*'tecnico'$re$,$new$'gestor','gestor_unidade','tecnico'$new$,'g');
 if definition=patched then raise exception 'Status capability source drift';end if;execute patched;
 definition:=pg_get_functiondef('sc_private.agenda_status_autorizada(text)'::regprocedure);
 patched:=replace(definition,'a.papel=''gestor''','(a.papel=''gestor'' or (a.papel=''gestor_unidade'' and public.sc_pode_gerir_unidade(e.unidade)))');
 if definition=patched then raise exception 'Status access source drift';end if;execute patched;
end $patch$;
commit;
