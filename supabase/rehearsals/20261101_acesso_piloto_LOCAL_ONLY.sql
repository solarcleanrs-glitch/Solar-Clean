-- LOCAL ONLY. Fundação de leitura para ensaio; não é autorização de implantação.
-- Requer auth.users e auth.uid() restaurados. Não cadastra usuários automaticamente.
-- Não modifica políticas/grants das tabelas antigas nem o Storage.
begin;
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
commit;
-- Sem INSERT/UPDATE/DELETE/TRUNCATE para a API, inclusive para gestor.
-- Bootstrap explícito por UUID confirmado e RPCs serão etapas independentes.
