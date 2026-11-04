-- EXECUTAR APENAS NO PROJETO "Solar Clean testes crm" após revisão.
-- Não altera tabelas de vistorias nem exclui dados.
create table if not exists public.crm_perfis(
 client_key text primary key,
 cliente text not null default '',
 telefone text not null default '',
 cidade text not null default '',
 last_visit_at timestamptz,
 recurrence_months integer check(recurrence_months between 1 and 36),
 updated_at timestamptz not null default now()
);
alter table public.crm_perfis enable row level security;
revoke all on public.crm_perfis from anon;
revoke all on public.crm_perfis from authenticated;
grant select,insert,update on public.crm_perfis to authenticated;
drop policy if exists crm_perfis_ler_equipe on public.crm_perfis;
drop policy if exists crm_perfis_inserir_equipe on public.crm_perfis;
drop policy if exists crm_perfis_atualizar_equipe on public.crm_perfis;
create policy crm_perfis_ler_equipe on public.crm_perfis for select to authenticated
 using(exists(select 1 from public.crm_usuarios u where u.user_id=(select auth.uid())));
create policy crm_perfis_inserir_equipe on public.crm_perfis for insert to authenticated
 with check(exists(select 1 from public.crm_usuarios u where u.user_id=(select auth.uid())));
create policy crm_perfis_atualizar_equipe on public.crm_perfis for update to authenticated
 using(exists(select 1 from public.crm_usuarios u where u.user_id=(select auth.uid())))
 with check(exists(select 1 from public.crm_usuarios u where u.user_id=(select auth.uid())));
