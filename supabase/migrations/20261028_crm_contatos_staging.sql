-- Execute primeiro em um projeto Supabase de HOMOLOGAÇÃO.
-- A criação da tabela não apaga vistorias nem modifica o CRM existente.
-- Este exemplo pressupõe que o gestor cadastrará no Supabase Auth
-- os IDs dos técnicos autorizados e os incluirá em crm_usuarios.
create table if not exists public.crm_usuarios (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.crm_usuarios enable row level security;
revoke all on public.crm_usuarios from anon;
revoke all on public.crm_usuarios from authenticated;
grant select on public.crm_usuarios to authenticated;
drop policy if exists crm_usuarios_ler_proprio on public.crm_usuarios;
create policy crm_usuarios_ler_proprio on public.crm_usuarios
  for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.crm_contatos (
  id uuid primary key,
  client_key text not null,
  created_at timestamptz not null default now(),
  outcome text not null,
  followup_date date,
  note text not null default ''
);
create index if not exists crm_contatos_client_date_idx
  on public.crm_contatos(client_key,created_at desc);
alter table public.crm_contatos enable row level security;
revoke all on public.crm_contatos from anon;
revoke all on public.crm_contatos from authenticated;
grant select, insert on public.crm_contatos to authenticated;
drop policy if exists crm_contatos_ler_equipe on public.crm_contatos;
drop policy if exists crm_contatos_inserir_equipe on public.crm_contatos;
create policy crm_contatos_ler_equipe on public.crm_contatos
  for select to authenticated using (
    exists (select 1 from public.crm_usuarios u where u.user_id=(select auth.uid()))
  );
create policy crm_contatos_inserir_equipe on public.crm_contatos
  for insert to authenticated with check (
    exists (select 1 from public.crm_usuarios u where u.user_id=(select auth.uid()))
  );

-- OPERACIONAL: somente um gestor autorizado pelo painel SQL (service role)
-- deve cadastrar os UUIDs reais dos técnicos após testar as políticas.
-- Nunca colocar service_role no código frontend. Sem integrantes cadastrados,
-- ninguém poderá ler ou inserir crm_contatos.
-- Exemplo manual a adaptar (NÃO execute sem conferir o UUID):
-- insert into public.crm_usuarios(user_id) values ('UUID_DO_TECNICO');
