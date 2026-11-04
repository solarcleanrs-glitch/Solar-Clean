-- PROPOSTA para Solar Clean testes crm. NÃO aplicada ao Supabase.
-- Requer auth.users, sc_is_manager e sc_parceiros já instalados.
-- Importação de UM evento revisado por chamada. Nunca cria agenda ou financeiro.
begin;
create table public.sc_clientes (
 id uuid primary key,
 cliente text not null check(length(btrim(cliente)) between 1 and 200),
 telefone text not null default '' check(telefone='' or telefone ~ '^\+55[0-9]{10,11}$'),
 cidade text not null default '' check(length(cidade)<=200),
 endereco text not null default '' check(length(endereco)<=1000),
 unidade text not null check(unidade in ('RS','SC')),
 origem text not null check(origem in ('particular','parceiro','nao_informada')),
 parceiro_id uuid references public.sc_parceiros(id),
 criado_por uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 revision integer not null default 1 check(revision>0),
 cadastro_inicial jsonb not null,
 check((origem='parceiro')=(parceiro_id is not null))
);
create table public.sc_cliente_origens_google (
 agenda_google text not null check(length(agenda_google) between 1 and 320),
 evento_google text not null check(length(evento_google) between 1 and 1024),
 cliente_id uuid not null references public.sc_clientes(id),
 evento_original jsonb not null check(jsonb_typeof(evento_original)='object'),
 confirmado_por uuid not null references auth.users(id),
 confirmado_em timestamptz not null default now(),
 primary key(agenda_google,evento_google)
);
alter table public.sc_clientes enable row level security;
alter table public.sc_cliente_origens_google enable row level security;
revoke all on public.sc_clientes,public.sc_cliente_origens_google from public,anon,authenticated;
grant select on public.sc_clientes,public.sc_cliente_origens_google to authenticated;
create policy sc_clientes_ler_gestor on public.sc_clientes for select to authenticated using ((select public.sc_is_manager()));
create policy sc_cliente_origens_ler_gestor on public.sc_cliente_origens_google for select to authenticated using ((select public.sc_is_manager()));

create function public.sc_importar_cliente_google(
 p_cliente_id uuid,p_agenda text,p_evento text,p_cadastro jsonb,p_original jsonb,p_revisado boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_cadastro jsonb; v_cliente public.sc_clientes%rowtype;
 v_origem public.sc_cliente_origens_google%rowtype;
 v_parceiro uuid;
begin
 if auth.uid() is null or not coalesce(public.sc_is_manager(),false) then
  raise exception 'Acesso restrito ao gestor' using errcode='42501';
 end if;
 if p_revisado is distinct from true then raise exception 'Confirme a revisão dos dados'; end if;
 if p_cliente_id is null or p_agenda is null or length(btrim(p_agenda)) not between 1 and 320
    or p_evento is null or length(btrim(p_evento)) not between 1 and 1024 then raise exception 'Origem e ID obrigatórios'; end if;
 if jsonb_typeof(p_cadastro) is distinct from 'object' or jsonb_typeof(p_original) is distinct from 'object'
    or octet_length(p_original::text)>262144 then raise exception 'Conteúdo inválido'; end if;
 if exists(select 1 from jsonb_object_keys(p_cadastro) k where k not in ('cliente','telefone','cidade','endereco','unidade','origem','parceiro_id')) then
  raise exception 'Campo de cadastro não permitido';
 end if;
 if p_original->>'id' is distinct from p_evento or p_original->>'status' is distinct from 'confirmed' then raise exception 'Evento incompatível'; end if;
 if exists(select 1 from jsonb_each(p_cadastro) e where e.key<>'parceiro_id' and jsonb_typeof(e.value)<>'string') then raise exception 'Campos devem ser textos'; end if;
 v_parceiro:=nullif(p_cadastro->>'parceiro_id','')::uuid;
 v_cadastro:=jsonb_build_object('cliente',btrim(p_cadastro->>'cliente'),'telefone',coalesce(p_cadastro->>'telefone',''),
  'cidade',coalesce(p_cadastro->>'cidade',''),'endereco',coalesce(p_cadastro->>'endereco',''),
  'unidade',p_cadastro->>'unidade','origem',p_cadastro->>'origem','parceiro_id',v_parceiro);
 -- Serialize source identity before client identity: retry cannot duplicate links.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_agenda||chr(0+31)||p_evento,0));
 select * into v_origem from public.sc_cliente_origens_google where agenda_google=p_agenda and evento_google=p_evento;
 if found then
  select * into strict v_cliente from public.sc_clientes where id=v_origem.cliente_id;
  if v_cliente.id<>p_cliente_id or v_cliente.cadastro_inicial<>v_cadastro or v_origem.evento_original<>p_original then
   raise exception 'Evento já importado com outro conteúdo';
  end if;
  return jsonb_build_object('cliente_id',v_cliente.id,'revision',v_cliente.revision,'repetido',true);
 end if;
 if v_parceiro is not null and not exists(select 1 from public.sc_parceiros where id=v_parceiro and ativo) then raise exception 'Parceiro indisponível'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_cliente_id::text,1));
 select * into v_cliente from public.sc_clientes where id=p_cliente_id;
 if found then
  if v_cliente.cadastro_inicial<>v_cadastro then raise exception 'Cliente existente com outro conteúdo'; end if;
 else
  insert into public.sc_clientes(id,cliente,telefone,cidade,endereco,unidade,origem,parceiro_id,criado_por,cadastro_inicial)
  values(p_cliente_id,v_cadastro->>'cliente',v_cadastro->>'telefone',v_cadastro->>'cidade',v_cadastro->>'endereco',
   v_cadastro->>'unidade',v_cadastro->>'origem',v_parceiro,auth.uid(),v_cadastro) returning * into v_cliente;
 end if;
 insert into public.sc_cliente_origens_google(agenda_google,evento_google,cliente_id,evento_original,confirmado_por)
 values(p_agenda,p_evento,p_cliente_id,p_original,auth.uid());
 return jsonb_build_object('cliente_id',v_cliente.id,'revision',v_cliente.revision,'repetido',false);
end $$;
revoke all on function public.sc_importar_cliente_google(uuid,text,text,jsonb,jsonb,boolean) from public,anon;
grant execute on function public.sc_importar_cliente_google(uuid,text,text,jsonb,jsonb,boolean) to authenticated;
commit;
