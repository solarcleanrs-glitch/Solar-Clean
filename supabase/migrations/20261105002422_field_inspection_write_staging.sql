-- CANDIDATE, NOT APPLIED. Requires revision trigger and both access candidates.
-- Technical writes only through these whitelisted RPCs; legacy table RLS stays.
begin;
do $$begin if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='vistorias' and column_name='revision') then raise exception 'Install inspection revision prerequisite first';end if;end $$;
create table sc_private.campo_vistoria_ids(
 visit_id uuid primary key,escopo_id uuid not null references public.sc_clientes_escopos(id),agenda_id text not null unique,actor uuid not null,created_at timestamptz not null default now());
create table sc_private.campo_vistoria_operacoes(
 id uuid primary key,visit_id uuid not null,escopo_id uuid not null,agenda_id text,actor uuid not null,
 base_revision bigint not null check(base_revision>=0),dados jsonb not null,fotos jsonb not null,
 confirmed boolean not null default false,cancelled boolean not null default false,result jsonb,created_at timestamptz not null default now(),
 check(not(confirmed and cancelled)),check(confirmed=(result is not null)));
alter table sc_private.campo_vistoria_ids enable row level security;
alter table sc_private.campo_vistoria_operacoes enable row level security;
revoke all on sc_private.campo_vistoria_ids,sc_private.campo_vistoria_operacoes from public,anon,authenticated;

create function sc_private.campos_vistoria_campo() returns text[] language sql immutable set search_path='' as $$
select array['cliente','telefone','cidade','endereco','placas','pot_placa','marca_placa','marca_inv','modelo_inv','ano_inst','telhado','sujeira','sujidades','estrutura','dps','qtd_dps','modelo_dps','inv_status','inv_internet','erro_inv','show_generation','antes','depois','pct','limpeza','retorno','tecnico','client_signature','signature_at','tech_signature']::text[];
$$;
create function sc_private.escopo_tecnico(p_escopo uuid) returns boolean language sql stable security definer set search_path='' as $$
select auth.uid() is not null and exists(select 1 from public.sc_acessos a join public.crm_usuarios c on c.user_id=a.user_id
 join public.sc_acesso_unidades u on u.user_id=a.user_id join public.sc_clientes_escopos s on s.unidade=u.unidade
 where a.user_id=auth.uid() and a.ativo and a.papel='tecnico' and s.id=p_escopo);
$$;
create function sc_private.agenda_vistoria_campo(p_agenda text) returns uuid language plpgsql stable security definer set search_path='' as $$
declare result uuid;begin
 select e.sc_escopo_id into result from public.agenda_eventos e join public.sc_clientes_escopos s on s.id=e.sc_escopo_id and s.unidade=e.unidade
 where e.id::text=p_agenda and e.arquivado_em is null and e.status<>'Cancelado' and sc_private.escopo_tecnico(s.id);
 if result is null then raise exception 'Agendamento indisponível para vistoria' using errcode='42501';end if;return result;
end $$;
create function sc_private.vistoria_campo_autorizada(p_visit uuid,p_escopo uuid) returns boolean language sql stable security definer set search_path='' as $$
select sc_private.escopo_tecnico(p_escopo) and (
 exists(select 1 from public.vistorias v where v.client_uuid=p_visit and v.sc_escopo_id=p_escopo)
 or (not exists(select 1 from public.vistorias v where v.client_uuid=p_visit) and exists(
 select 1 from sc_private.campo_vistoria_ids d join public.agenda_eventos e on e.id::text=d.agenda_id
 join public.sc_clientes_escopos s on s.id=e.sc_escopo_id and s.unidade=e.unidade
 where d.visit_id=p_visit and d.actor=auth.uid() and d.escopo_id=p_escopo and e.sc_escopo_id=p_escopo and e.arquivado_em is null and e.status<>'Cancelado')));
$$;
create function sc_private.vistoria_do_agendamento_campo(p_agenda text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare scope uuid;d sc_private.campo_vistoria_ids%rowtype;begin
 scope:=sc_private.agenda_vistoria_campo(p_agenda);select * into d from sc_private.campo_vistoria_ids where agenda_id=p_agenda and escopo_id=scope;
 if not found then return null;end if;
 return jsonb_build_object('vistoria_id',d.visit_id,'confirmed',exists(select 1 from public.vistorias where client_uuid=d.visit_id and sc_escopo_id=scope),'own',d.actor=auth.uid());
end $$;
create function sc_private.foto_vistoria_campo(p jsonb,p_visit uuid) returns boolean language sql immutable set search_path='' as $$
select coalesce(jsonb_typeof(p)='object' and p->>'category' in ('Antes','Depois','Telhado','DPS','Inversor','Problema','Foto')
 and p->>'type' in ('image/jpeg','image/png','image/webp') and left(p->>'storagePath',37)=p_visit::text||'/'
 and position('..' in p->>'storagePath')=0,false);
$$;
create function sc_private.edicao_vistoria_campo(p_visit uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v public.vistorias%rowtype;data jsonb;photos jsonb;begin
 select * into v from public.vistorias where client_uuid=p_visit;
 if not found or not sc_private.escopo_tecnico(v.sc_escopo_id) then raise exception 'Vistoria indisponível' using errcode='42501';end if;
 select jsonb_object_agg(key,value) into data from jsonb_each(to_jsonb(v)) where key=any(sc_private.campos_vistoria_campo());
 select coalesce(jsonb_agg(jsonb_build_object('name',p->>'name','type',p->>'type','category',p->>'category','storagePath',p->>'storagePath') order by ord),'[]') into photos
 from jsonb_array_elements(case when jsonb_typeof(v.media_manifest)='array' then v.media_manifest else '[]' end) with ordinality a(p,ord) where sc_private.foto_vistoria_campo(p,p_visit);
 return jsonb_build_object('vistoria_id',p_visit,'scope_id',v.sc_escopo_id,'revision',v.revision,'created_at',v.created_at,'updated_at',v.updated_at,'data',data,'photos',photos);
end $$;

create function sc_private.preparar_vistoria_campo(p_operacao uuid,p_vistoria uuid,p_agendamento text,p_revision bigint,p_dados jsonb,p_fotos jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare w sc_private.campo_vistoria_operacoes%rowtype;v public.vistorias%rowtype;scope uuid;item record;photo jsonb;old_photo boolean;dummy public.vistorias%rowtype;
begin
 if auth.uid() is null or p_operacao is null or p_vistoria is null or p_revision is null or p_revision<0 or p_revision>=9007199254740991 then raise exception 'Identificação/revisão inválida' using errcode='22023';end if;
 select * into w from sc_private.campo_vistoria_operacoes where id=p_operacao;
 if found then
  if w.actor<>auth.uid() or not sc_private.vistoria_campo_autorizada(w.visit_id,w.escopo_id) then raise exception 'Operação indisponível' using errcode='42501';end if;
  if w.cancelled then raise exception 'Tentativa abandonada; confira a versão da nuvem' using errcode='40001';end if;
  if w.visit_id<>p_vistoria or w.agenda_id is distinct from p_agendamento or w.base_revision<>p_revision or w.dados is distinct from p_dados or w.fotos is distinct from p_fotos then raise exception 'Tentativa já usada com outro conteúdo' using errcode='23505';end if;
  return jsonb_build_object('operacao_id',w.id,'vistoria_id',w.visit_id,'confirmed',w.confirmed);
 end if;
 if jsonb_typeof(p_dados) is distinct from 'object' or octet_length(p_dados::text)>1500000 or exists(select 1 from jsonb_object_keys(p_dados) k where not k=any(sc_private.campos_vistoria_campo())) then raise exception 'Campos de vistoria inválidos ou restritos' using errcode='22023';end if;
 for item in select key,value from jsonb_each(p_dados) loop
  if item.key=any(array['placas','pot_placa','antes','depois','pct']) then
   if jsonb_typeof(item.value) not in ('number','null') then raise exception 'Número inválido: %',item.key using errcode='22023';end if;
   if jsonb_typeof(item.value)='number' and ((item.value::text)::numeric>1000000000 or (item.value::text)::numeric<case when item.key='pct' then -100 else 0 end) then raise exception 'Número fora do limite' using errcode='22023';end if;
  elsif item.key='show_generation' then if jsonb_typeof(item.value)<>'boolean' then raise exception 'Geração inválida' using errcode='22023';end if;
  elsif item.key='sujidades' then
   if jsonb_typeof(item.value)<>'array' or jsonb_array_length(item.value)>30 then raise exception 'Sujidades inválidas' using errcode='22023';end if;
   if exists(select 1 from jsonb_array_elements(item.value) x where jsonb_typeof(x)<>'string' or length(x#>>'{}')>80) then raise exception 'Sujidade inválida' using errcode='22023';end if;
  elsif item.key in ('client_signature','tech_signature') then
   if jsonb_typeof(item.value) not in ('string','null') or length(item.value#>>'{}')>250000 or coalesce(item.value#>>'{}','') not in ('') and (item.value#>>'{}')!~ '^data:image/png;base64,[A-Za-z0-9+/=]+$' then raise exception 'Assinatura inválida' using errcode='22023';end if;
  else if jsonb_typeof(item.value) not in ('string','null') or length(item.value#>>'{}')>2000 then raise exception 'Texto inválido: %',item.key using errcode='22023';end if;end if;
 end loop;
 if p_dados?'inv_internet' and p_dados->'inv_internet'='null'::jsonb then raise exception 'Estado de internet inválido' using errcode='22023';end if;
 select * into dummy from jsonb_populate_record(null::public.vistorias,p_dados);
 select * into v from public.vistorias where client_uuid=p_vistoria;
 if found then
  scope:=v.sc_escopo_id;if not sc_private.escopo_tecnico(scope) then raise exception 'Vistoria indisponível' using errcode='42501';end if;
  if p_agendamento is not null or p_revision<>v.revision then raise exception 'Vistoria alterada; confira a revisão' using errcode='40001';end if;
 else
  if p_revision<>0 then raise exception 'Vistoria indisponível' using errcode='42501';end if;
  scope:=sc_private.agenda_vistoria_campo(p_agendamento);
  if exists(select 1 from storage.objects where bucket_id='vistoria-media' and split_part(name,'/',1)=p_vistoria::text)
   and not exists(select 1 from sc_private.campo_vistoria_ids where visit_id=p_vistoria and actor=auth.uid() and escopo_id=scope and agenda_id=p_agendamento) then raise exception 'UUID de mídia já utilizado' using errcode='42501';end if;
  insert into sc_private.campo_vistoria_ids(visit_id,escopo_id,agenda_id,actor) values(p_vistoria,scope,p_agendamento,auth.uid()) on conflict do nothing;
  if not exists(select 1 from sc_private.campo_vistoria_ids where visit_id=p_vistoria and actor=auth.uid() and escopo_id=scope and agenda_id=p_agendamento) then
   if exists(select 1 from sc_private.campo_vistoria_ids where agenda_id=p_agendamento) then raise exception 'Agendamento já possui outra tentativa de vistoria' using errcode='23505';end if;
   raise exception 'UUID reservado para outro contexto' using errcode='42501';end if;
 end if;
 if jsonb_typeof(p_fotos) is distinct from 'array' or jsonb_array_length(p_fotos)>30 then raise exception 'Lista de fotos inválida' using errcode='22023';end if;
 if (select count(distinct p->>'storagePath') from jsonb_array_elements(p_fotos) p)<>jsonb_array_length(p_fotos) then raise exception 'Fotos repetidas' using errcode='22023';end if;
 for photo in select value from jsonb_array_elements(p_fotos) loop
  if not sc_private.foto_vistoria_campo(photo,p_vistoria) or length(photo->>'name')>160 or exists(select 1 from jsonb_object_keys(photo) k where k not in ('name','type','category','storagePath')) then raise exception 'Foto inválida ou interna' using errcode='22023';end if;
  select exists(select 1 from jsonb_array_elements(case when jsonb_typeof(v.media_manifest)='array' then v.media_manifest else '[]' end) p where p->>'storagePath'=photo->>'storagePath' and sc_private.foto_vistoria_campo(p,p_vistoria)) into old_photo;
  if not old_photo and (photo->>'storagePath')!~ ('^'||p_vistoria::text||'/campo/'||p_operacao::text||'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$') then raise exception 'Caminho de foto não reservado' using errcode='22023';end if;
 end loop;
 insert into sc_private.campo_vistoria_operacoes(id,visit_id,escopo_id,agenda_id,actor,base_revision,dados,fotos) values(p_operacao,p_vistoria,scope,p_agendamento,auth.uid(),p_revision,p_dados,p_fotos);
 return jsonb_build_object('operacao_id',p_operacao,'vistoria_id',p_vistoria,'confirmed',false);
end $$;

create function sc_private.midia_campo_permitida(p_name text,p_insert boolean) returns boolean language sql stable security definer set search_path='' as $$
select auth.uid() is not null and ((not p_insert and exists(select 1 from public.vistorias v,jsonb_array_elements(case when jsonb_typeof(v.media_manifest)='array' then v.media_manifest else '[]' end) p
 where sc_private.escopo_tecnico(v.sc_escopo_id) and p->>'storagePath'=p_name and sc_private.foto_vistoria_campo(p,v.client_uuid))) or exists(select 1 from sc_private.campo_vistoria_operacoes w,jsonb_array_elements(w.fotos) p
 where w.actor=auth.uid() and not w.confirmed and not w.cancelled and p->>'storagePath'=p_name
 and left(p_name,80)=w.visit_id::text||'/campo/'||w.id::text||'/'
 and sc_private.vistoria_campo_autorizada(w.visit_id,w.escopo_id)));
$$;

-- An invoker trigger can distinguish the narrowly privileged commit function
-- from direct API writes. Authenticated callers still use the manager checks.
create function sc_private.reserva_gerencia_valida(p_visit uuid,p_escopo uuid) returns boolean language sql stable security definer set search_path='' as $$
select public.sc_pode_gerir_escopo(p_escopo) and exists(select 1 from sc_private.midias_gerencia m where m.visit_id=p_visit and m.escopo_id=p_escopo);
$$;
revoke all on function sc_private.reserva_gerencia_valida(uuid,uuid) from public,anon,authenticated;
grant execute on function sc_private.reserva_gerencia_valida(uuid,uuid) to authenticated;
create or replace function sc_private.validar_reserva_gerencia() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_user='postgres' then return new;end if;
 if public.sc_is_manager() then return new;end if;
 if not public.sc_pode_gerir_escopo(new.sc_escopo_id) then raise exception 'Escopo não autorizado' using errcode='42501';end if;
 if TG_OP='UPDATE' and new.client_uuid=old.client_uuid and new.sc_escopo_id=old.sc_escopo_id then return new;end if;
 if not sc_private.reserva_gerencia_valida(new.client_uuid,new.sc_escopo_id) then raise exception 'Reserva de vistoria necessária' using errcode='42501';end if;return new;
end $$;
revoke all on function sc_private.validar_reserva_gerencia() from public,anon,authenticated;

create function sc_private.confirmar_vistoria_campo(p_operacao uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare w sc_private.campo_vistoria_operacoes%rowtype;v public.vistorias%rowtype;e public.agenda_eventos%rowtype;data jsonb;internal_photos jsonb;photos jsonb;photo jsonb;columns text;rev bigint;stamp timestamptz;
begin
 select * into w from sc_private.campo_vistoria_operacoes where id=p_operacao for update;
 if not found or w.actor<>auth.uid() or not sc_private.vistoria_campo_autorizada(w.visit_id,w.escopo_id) then raise exception 'Operação indisponível' using errcode='42501';end if;
 if w.cancelled then raise exception 'Tentativa abandonada; confira a versão da nuvem' using errcode='40001';end if;
 if w.confirmed then return w.result||jsonb_build_object('repetido',true,'estado_atual',sc_private.edicao_vistoria_campo(w.visit_id));end if;
 select * into v from public.vistorias where client_uuid=w.visit_id for update;
 if not sc_private.escopo_tecnico(w.escopo_id) or (v.client_uuid is not null and v.sc_escopo_id is distinct from w.escopo_id) then raise exception 'Operação indisponível' using errcode='42501';end if;
 if (found and v.revision<>w.base_revision) or (not found and w.base_revision<>0) then raise exception 'Vistoria alterada; confira a revisão' using errcode='40001';end if;
 if w.base_revision=0 and v.client_uuid is not null then raise exception 'Vistoria já criada por outra tentativa' using errcode='40001';end if;
 for photo in select value from jsonb_array_elements(w.fotos) loop
  if not exists(select 1 from storage.objects o where o.bucket_id='vistoria-media' and o.name=photo->>'storagePath'
   and o.metadata->>'mimetype'=photo->>'type' and (o.metadata->>'size')~'^[0-9]+$' and (o.metadata->>'size')::bigint between 1 and 5242880) then raise exception 'Foto ainda não confirmada no armazenamento' using errcode='23514';end if;
 end loop;
 if v.client_uuid is not null and jsonb_typeof(v.media_manifest)<>'array' then raise exception 'Manifesto antigo exige conferência do gestor' using errcode='23514';end if;
 select coalesce(jsonb_agg(p),'[]') into internal_photos from jsonb_array_elements(coalesce(v.media_manifest,'[]')) p where not sc_private.foto_vistoria_campo(p,w.visit_id);
 select coalesce(jsonb_agg(coalesce((select x from jsonb_array_elements(coalesce(v.media_manifest,'[]')) x where x->>'storagePath'=p->>'storagePath' and sc_private.foto_vistoria_campo(x,w.visit_id) limit 1),'{}')||p order by ord),'[]') into photos from jsonb_array_elements(w.fotos) with ordinality a(p,ord);
 if w.base_revision=0 then
  select * into e from public.agenda_eventos where id::text=w.agenda_id for share;
  if sc_private.agenda_vistoria_campo(w.agenda_id)<>w.escopo_id then raise exception 'Agendamento alterado' using errcode='40001';end if;
  data:=jsonb_build_object('cliente',e.cliente,'telefone',e.telefone,'cidade',e.cidade,'endereco',e.endereco,'placas',e.placas,'show_generation',true,'inv_internet','Não verificado','sujidades','[]'::jsonb);
 else data:=to_jsonb(v);end if;
 data:=data||w.dados||jsonb_build_object('client_uuid',w.visit_id,'sc_escopo_id',w.escopo_id,'media_manifest',internal_photos||photos,'tecnico_email',(select email from auth.users where id=auth.uid()));
 if coalesce(btrim(data->>'cliente'),'')='' then raise exception 'Informe o cliente da vistoria' using errcode='22023';end if;
 select string_agg(quote_ident(k),',') into columns from unnest(sc_private.campos_vistoria_campo()||array['media_manifest','tecnico_email']) k;
 begin
 if w.base_revision=0 then
  columns:=columns||',client_uuid,sc_escopo_id';
  execute 'insert into public.vistorias ('||columns||') select '||columns||' from jsonb_populate_record(null::public.vistorias,$1) returning revision,updated_at' into rev,stamp using data;
 else
  execute 'update public.vistorias set ('||columns||')=(select '||columns||' from jsonb_populate_record(null::public.vistorias,$1)) where client_uuid=$2 returning revision,updated_at' into rev,stamp using data,w.visit_id;
 end if;
 exception when others then
  -- Constraint DETAIL may contain the complete row, including private values.
  raise exception 'Gravação técnica recusada; confira os campos e a revisão' using errcode='22023';
 end;
 update sc_private.campo_vistoria_operacoes set confirmed=true,result=jsonb_build_object('operacao_id',w.id,'vistoria_id',w.visit_id,'revision',rev,'updated_at',stamp,'repetido',false) where id=w.id returning result into data;
 return data||jsonb_build_object('estado_atual',sc_private.edicao_vistoria_campo(w.visit_id));
end $$;
alter function sc_private.confirmar_vistoria_campo(uuid) owner to postgres;
create function sc_private.abandonar_vistoria_campo(p_operacao uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare w sc_private.campo_vistoria_operacoes%rowtype;begin
 select * into w from sc_private.campo_vistoria_operacoes where id=p_operacao for update;
 if not found or w.actor<>auth.uid() or not sc_private.vistoria_campo_autorizada(w.visit_id,w.escopo_id) then raise exception 'Operação indisponível' using errcode='42501';end if;
 if not w.confirmed then update sc_private.campo_vistoria_operacoes set cancelled=true where id=w.id;end if;
 return jsonb_build_object('operacao_id',w.id,'confirmed',w.confirmed,'cancelled',not w.confirmed);
end $$;

create function public.sc_vistoria_campo_edicao(p_vistoria uuid) returns jsonb language sql stable security invoker set search_path='' as $$select sc_private.edicao_vistoria_campo(p_vistoria)$$;
create function public.sc_vistoria_agendamento_campo(p_agendamento text) returns jsonb language sql stable security invoker set search_path='' as $$select sc_private.vistoria_do_agendamento_campo(p_agendamento)$$;
create function public.sc_preparar_vistoria_campo(p_operacao uuid,p_vistoria uuid,p_agendamento text,p_revision bigint,p_dados jsonb,p_fotos jsonb) returns jsonb language sql security invoker set search_path='' as $$select sc_private.preparar_vistoria_campo(p_operacao,p_vistoria,p_agendamento,p_revision,p_dados,p_fotos)$$;
create function public.sc_confirmar_vistoria_campo(p_operacao uuid) returns jsonb language sql security invoker set search_path='' as $$select sc_private.confirmar_vistoria_campo(p_operacao)$$;
create function public.sc_abandonar_vistoria_campo(p_operacao uuid) returns jsonb language sql security invoker set search_path='' as $$select sc_private.abandonar_vistoria_campo(p_operacao)$$;
revoke all on function sc_private.abandonar_vistoria_campo(uuid),public.sc_abandonar_vistoria_campo(uuid) from public,anon,authenticated;
grant execute on function sc_private.abandonar_vistoria_campo(uuid),public.sc_abandonar_vistoria_campo(uuid) to authenticated;
revoke all on function sc_private.campos_vistoria_campo(),sc_private.escopo_tecnico(uuid),sc_private.agenda_vistoria_campo(text),sc_private.vistoria_campo_autorizada(uuid,uuid),sc_private.foto_vistoria_campo(jsonb,uuid),sc_private.edicao_vistoria_campo(uuid),sc_private.preparar_vistoria_campo(uuid,uuid,text,bigint,jsonb,jsonb),sc_private.midia_campo_permitida(text,boolean),sc_private.confirmar_vistoria_campo(uuid),public.sc_vistoria_campo_edicao(uuid),public.sc_preparar_vistoria_campo(uuid,uuid,text,bigint,jsonb,jsonb),public.sc_confirmar_vistoria_campo(uuid) from public,anon,authenticated;
revoke all on function sc_private.vistoria_do_agendamento_campo(text),public.sc_vistoria_agendamento_campo(text) from public,anon,authenticated;
grant execute on function sc_private.vistoria_do_agendamento_campo(text),public.sc_vistoria_agendamento_campo(text) to authenticated;
grant execute on function sc_private.edicao_vistoria_campo(uuid),sc_private.preparar_vistoria_campo(uuid,uuid,text,bigint,jsonb,jsonb),sc_private.midia_campo_permitida(text,boolean),sc_private.confirmar_vistoria_campo(uuid),public.sc_vistoria_campo_edicao(uuid),public.sc_preparar_vistoria_campo(uuid,uuid,text,bigint,jsonb,jsonb),public.sc_confirmar_vistoria_campo(uuid) to authenticated;

alter policy sc_vistoria_media_gestor_provisorio on storage.objects
 using(bucket_id<>'vistoria-media' or sc_private.midia_gerenciavel(name) or sc_private.report_photo_allowed(name) or sc_private.midia_campo_permitida(name,false))
 with check(bucket_id<>'vistoria-media' or sc_private.midia_gerenciavel(name) or sc_private.midia_campo_permitida(name,true));
alter policy sc_vistoria_media_legacy_guard on storage.objects
 using(bucket_id<>'vistoria-media' or sc_private.midia_gerenciavel(name) or sc_private.report_photo_allowed(name) or sc_private.midia_campo_permitida(name,false))
 with check(bucket_id<>'vistoria-media' or sc_private.midia_gerenciavel(name) or sc_private.midia_campo_permitida(name,true));
-- UPDATE/DELETE restrictive guards stay manager-only. No photo replacement/removal.
do $$declare definition text;patched text;begin
 definition:=pg_get_functiondef('sc_private.acesso_operacional()'::regprocedure);
 patched:=regexp_replace(definition,$re$'visits_write'\s*,\s*manager$re$,$new$'visits_write',(manager or (role_name='tecnico' and cardinality(units)>0))$new$);
 if definition=patched then raise exception 'Technical write capability source drift';end if;execute patched;
 definition:=pg_get_functiondef('sc_private.relatorio_campo(uuid)'::regprocedure);
 patched:=replace(definition,$old$'Antes','Depois','Telhado','Problema','Foto'$old$,$new$'Antes','Depois','Telhado','DPS','Inversor','Problema','Foto'$new$);
 if definition=patched then raise exception 'Technical report photo source drift';end if;execute patched;
end $$;
commit;
