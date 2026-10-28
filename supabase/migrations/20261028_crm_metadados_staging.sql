-- Execute somente no projeto Solar Clean testes crm.
-- Tabela privada, visível apenas a usuários permitidos no CRM.
create table if not exists public.crm_metadados (
  client_key text primary key,
  last_contact_at date,
  internal_note text not null default '',
  loss_reason text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.crm_metadados enable row level security;
drop policy if exists crm_metadados_select_usuarios on public.crm_metadados;
create policy crm_metadados_select_usuarios on public.crm_metadados
for select to authenticated
using (exists (select 1 from public.crm_usuarios u where u.user_id = (select auth.uid())));
drop policy if exists crm_metadados_insert_usuarios on public.crm_metadados;
create policy crm_metadados_insert_usuarios on public.crm_metadados
for insert to authenticated
with check (exists (select 1 from public.crm_usuarios u where u.user_id = (select auth.uid())));
drop policy if exists crm_metadados_update_usuarios on public.crm_metadados;
create policy crm_metadados_update_usuarios on public.crm_metadados
for update to authenticated
using (exists (select 1 from public.crm_usuarios u where u.user_id = (select auth.uid())))
with check (exists (select 1 from public.crm_usuarios u where u.user_id = (select auth.uid())));
grant select,insert,update on public.crm_metadados to authenticated;
revoke all on public.crm_metadados from anon;
