-- MIGRAÇÃO PROPOSTA: executar primeiro em um projeto Supabase de teste.
-- NÃO executar em produção sem validar autenticação, RLS e acesso por equipe.
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
-- Não criar políticas abertas para anon. Sem políticas, ninguém terá acesso por REST.
-- Configurar políticas por usuário/equipe depois que o app usar sessões Auth.
