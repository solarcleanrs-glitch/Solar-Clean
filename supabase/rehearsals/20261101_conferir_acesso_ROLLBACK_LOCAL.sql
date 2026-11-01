-- ENSAIO LOCAL REVERSÍVEL. Exige parâmetros explícitos de identidade.
-- Não executar no SQL Editor. Execute psql contra 127.0.0.1, banco restaurado.
begin;
select set_config('sc_rehearsal.manager_uuid', :'manager_uuid', true);
select set_config('sc_rehearsal.manager_email', :'manager_email', true);
select set_config('sc_rehearsal.other_uuid', :'other_uuid', true);
do $$
begin
 if current_database()<>'solar_clean_oficial_restore' then raise exception 'Banco local restaurado obrigatório'; end if;
 if not exists(select 1 from auth.users where id=current_setting('sc_rehearsal.manager_uuid')::uuid and email=current_setting('sc_rehearsal.manager_email')) then raise exception 'Identidade do gestor divergente'; end if;
 if current_setting('sc_rehearsal.other_uuid')=current_setting('sc_rehearsal.manager_uuid') or not exists(select 1 from auth.users where id=current_setting('sc_rehearsal.other_uuid')::uuid) then raise exception 'Outra conta existente e distinta obrigatória'; end if;
end;
$$;
create temporary table sc_pilot_before on commit drop as
 select 'agenda'::text as tipo,to_jsonb(a) as registro from public.agenda_eventos a
 union all select 'vistorias',to_jsonb(v) from public.vistorias v
 union all select 'crm',to_jsonb(c) from public.crm_clientes c;
-- LOCAL ONLY. Fundação de leitura para ensaio; não é autorização de implantação.
-- Requer auth.users e auth.uid() restaurados. Não cadastra usuários automaticamente.
-- Não modifica políticas/grants das tabelas antigas nem o Storage.
set local lock_timeout='5s';
set local statement_timeout='30s';
create table public.sc_parceiros(
 id uuid primary key default gen_random_uuid(),nome text not null unique check(length(btrim(nome))>0),ativo boolean not null default true
);
create table public.sc_acessos(
 user_id uuid primary key references auth.users(id),
 papel text not null check(papel in ('gestor','tecnico','financeiro','parceiro')),
 parceiro_id uuid references public.sc_parceiros(id),ativo boolean not null default false,
 check((papel='parceiro' and parceiro_id is not null) or (papel<>'parceiro' and parceiro_id is null))
);
create table public.sc_acesso_unidades(
 user_id uuid not null references public.sc_acessos(user_id),
 unidade text not null check(unidade in ('RS','SC')),primary key(user_id,unidade)
);
create table public.sc_clientes_escopos(
 id uuid primary key default gen_random_uuid(),legacy_client_key text,
 unidade text not null check(unidade in ('RS','SC')),
 parceiro_id uuid references public.sc_parceiros(id),created_at timestamptz not null default now()
);
alter table public.sc_parceiros enable row level security;
alter table public.sc_acessos enable row level security;
alter table public.sc_acesso_unidades enable row level security;
alter table public.sc_clientes_escopos enable row level security;
revoke all on public.sc_parceiros,public.sc_acessos,public.sc_acesso_unidades,public.sc_clientes_escopos from public,anon,authenticated;
create function public.sc_is_manager() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.sc_acessos a where a.user_id=(select auth.uid()) and a.papel='gestor' and a.ativo);
$$;
alter function public.sc_is_manager() owner to postgres;
revoke all on function public.sc_is_manager() from public,anon,authenticated;
grant execute on function public.sc_is_manager() to authenticated;
grant select on public.sc_parceiros,public.sc_acessos,public.sc_acesso_unidades,public.sc_clientes_escopos to authenticated;
create policy sc_piloto_gestor_ler on public.sc_parceiros for select to authenticated using((select public.sc_is_manager()));
create policy sc_piloto_gestor_ler on public.sc_acessos for select to authenticated using((select public.sc_is_manager()));
create policy sc_piloto_gestor_ler on public.sc_acesso_unidades for select to authenticated using((select public.sc_is_manager()));
create policy sc_piloto_gestor_ler on public.sc_clientes_escopos for select to authenticated using((select public.sc_is_manager()));
-- Sem INSERT/UPDATE/DELETE/TRUNCATE para a API, inclusive para gestor.
-- Bootstrap explícito por UUID confirmado e RPCs serão etapas independentes.

insert into public.sc_acessos(user_id,papel,ativo) values(current_setting('sc_rehearsal.manager_uuid')::uuid,'gestor',true);
insert into public.sc_acesso_unidades(user_id,unidade) values(current_setting('sc_rehearsal.manager_uuid')::uuid,'RS'),(current_setting('sc_rehearsal.manager_uuid')::uuid,'SC');
select set_config('request.jwt.claim.sub',current_setting('sc_rehearsal.manager_uuid'),true);
set local role authenticated;
do $$
begin
 if not public.sc_is_manager() or (select count(*) from public.sc_acessos)<>1 then raise exception 'Gestor não confirmado'; end if;
 begin
  update public.sc_acessos set ativo=false;
  raise exception 'API conseguiu editar papéis';
 exception when insufficient_privilege then null;
 end;
end;
$$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('sc_rehearsal.other_uuid'),true);
set local role authenticated;
do $$
begin
 if public.sc_is_manager() or (select count(*) from public.sc_acessos)<>0 or (select count(*) from public.sc_acesso_unidades)<>0 then raise exception 'Conta sem papel recebeu acesso'; end if;
 begin
  insert into public.sc_acessos(user_id,papel,ativo) values(auth.uid(),'gestor',true);
  raise exception 'Autopromoção permitida';
 exception when insufficient_privilege then null;
 end;
end;
$$;
reset role;
update public.sc_acessos set ativo=false where user_id=current_setting('sc_rehearsal.manager_uuid')::uuid;
select set_config('request.jwt.claim.sub',current_setting('sc_rehearsal.manager_uuid'),true);
set local role authenticated;
do $$ begin if public.sc_is_manager() then raise exception 'Revogação ineficaz'; end if; end; $$;
reset role;
create temporary table sc_pilot_after on commit drop as
 select 'agenda'::text as tipo,to_jsonb(a) as registro from public.agenda_eventos a
 union all select 'vistorias',to_jsonb(v) from public.vistorias v
 union all select 'crm',to_jsonb(c) from public.crm_clientes c;
do $$ begin
 if exists((select * from sc_pilot_before except all select * from sc_pilot_after) union all (select * from sc_pilot_after except all select * from sc_pilot_before)) then raise exception 'Dados originais alterados'; end if;
end; $$;
select 'PASSOU: gestor, bloqueio de outra conta, autopromoção negada, revogação e dados preservados' as resultado;
rollback;
select 'ROLLBACK concluído' as resultado,to_regclass('public.sc_acessos') is null as estruturas_de_teste_removidas;
