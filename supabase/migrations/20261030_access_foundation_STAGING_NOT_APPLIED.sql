-- PROPOSTA NÃO APLICADA. Exclusivamente projeto zzphucuiqhzrilrddxnf.
-- Etapa aditiva: NÃO substitui políticas existentes nem libera acesso por função.
-- Exige autorização explícita antes de execução manual no projeto de testes.
-- Verificar o projeto no painel: SQL não identifica com segurança o projeto hospedado.
begin;

-- Falhar em execução repetida/estrutura inesperada, em vez de mascarar divergências.
create table public.sc_parceiros (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(btrim(nome)) > 0),
  ativo boolean not null default true
);

create table public.sc_acessos (
  user_id uuid primary key references public.crm_usuarios(user_id) on delete cascade,
  papel text not null check (papel in ('gestor', 'tecnico', 'financeiro', 'parceiro')),
  parceiro_id uuid references public.sc_parceiros(id),
  ativo boolean not null default false,
  check ((papel = 'parceiro' and parceiro_id is not null)
      or (papel <> 'parceiro' and parceiro_id is null))
);

create table public.sc_acesso_unidades (
  user_id uuid not null references public.sc_acessos(user_id) on delete cascade,
  unidade text not null check (unidade in ('RS', 'SC')),
  primary key (user_id, unidade)
);

-- Um telefone/cliente pode ter escopos diferentes. Nunca agrupar por nome ou cidade.
-- client_key é apenas vínculo legado; não é identidade global nem prova de autorização.
create table public.sc_clientes_escopos (
  id uuid primary key default gen_random_uuid(),
  legacy_client_key text check (legacy_client_key is null or length(btrim(legacy_client_key)) > 0),
  unidade text not null check (unidade in ('RS', 'SC')),
  parceiro_id uuid references public.sc_parceiros(id),
  created_at timestamptz not null default now()
);
create index sc_clientes_escopos_legacy_idx
  on public.sc_clientes_escopos(legacy_client_key);
create index sc_clientes_escopos_unidade_parceiro_idx
  on public.sc_clientes_escopos(unidade, parceiro_id);

-- Um único vínculo evita unidade e parceiro contraditórios na mesma vistoria.
-- Legado fica NULL até classificação humana; nenhum registro é inferido ou movido.
alter table public.vistorias
  add column sc_escopo_id uuid references public.sc_clientes_escopos(id);
create index vistorias_sc_escopo_idx on public.vistorias(sc_escopo_id);

-- As tabelas novas ficam inacessíveis à API comum nesta etapa, mesmo com defaults
-- do projeto concedendo privilégios. Sem cadastro automático de usuários/parceiros.
alter table public.sc_parceiros enable row level security;
alter table public.sc_acessos enable row level security;
alter table public.sc_acesso_unidades enable row level security;
alter table public.sc_clientes_escopos enable row level security;
revoke all on table public.sc_parceiros, public.sc_acessos,
  public.sc_acesso_unidades, public.sc_clientes_escopos
  from public, anon, authenticated;

commit;

-- Não executar rollback destrutivo automático: depois de haver classificação,
-- preservar os vínculos em backup e revisar as dependências antes de remover colunas.
