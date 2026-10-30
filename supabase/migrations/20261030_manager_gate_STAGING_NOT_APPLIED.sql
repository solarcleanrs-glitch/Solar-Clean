-- SEGUNDA ETAPA: PROPOSTA, NÃO APLICADA. Requer autorização específica.
-- Projeto exclusivo: Solar Clean testes crm / zzphucuiqhzrilrddxnf.
-- Cadastrar gestor e limitar API a gestores ativos até implementar projeções por papel.
-- Não concede acesso a técnicos/parceiros nem publica aplicativo.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Modelo de fonte sem identificadores pessoais. A aplicação histórica foi feita
-- com a conta confirmada pelo usuário. NÃO reaplicar em projeto já configurado.
-- Em instalação nova, preencher LOCALMENTE sc_bootstrap.manager_uuid e
-- sc_bootstrap.manager_email nesta transação, após confirmar a identidade.
-- Parâmetros ausentes causam erro; nunca escolher automaticamente a primeira conta.
do $$
declare
  manager_uuid uuid := nullif(current_setting('sc_bootstrap.manager_uuid', true), '')::uuid;
  manager_email text := nullif(current_setting('sc_bootstrap.manager_email', true), '');
begin
  if manager_uuid is null or manager_email is null then
    raise exception 'Identidade do gestor deve ser confirmada e preenchida localmente.';
  end if;
  if not exists (
    select 1 from public.crm_usuarios u
    join auth.users a on a.id = u.user_id
    where u.user_id = manager_uuid and a.email = manager_email
  ) then
    raise exception 'Conta de testes divergente. Operação cancelada.';
  end if;
  -- Sem ON CONFLICT: instalação divergente ou repetida exige revisão.
  insert into public.sc_acessos (user_id, papel, parceiro_id, ativo)
    values (manager_uuid, 'gestor', null, true);
  insert into public.sc_acesso_unidades (user_id, unidade)
    values (manager_uuid, 'RS'), (manager_uuid, 'SC');
end;
$$;

-- Helper sem parâmetros: identidade vem exclusivamente do JWT autenticado.
-- SECURITY DEFINER evita recursão na política de sc_acessos. Não executa escrita.
-- Dono fixo, search_path vazio e referências qualificadas evitam resolução ambígua.
create function public.sc_is_manager()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sc_acessos a
    where a.user_id = (select auth.uid())
      and a.papel = 'gestor' and a.ativo
  );
$$;
alter function public.sc_is_manager() owner to postgres;
revoke all on function public.sc_is_manager() from public, anon, authenticated;
grant execute on function public.sc_is_manager() to authenticated;

-- Somente o gestor ativo poderá ler e administrar os cadastros de acesso.
-- Não conceder DELETE, TRUNCATE, REFERENCES ou TRIGGER à API.
grant select, insert, update on table public.sc_parceiros, public.sc_acessos,
  public.sc_acesso_unidades, public.sc_clientes_escopos to authenticated;

create policy sc_parceiros_gestor on public.sc_parceiros
for all to authenticated
using ((select public.sc_is_manager()))
with check ((select public.sc_is_manager()));
create policy sc_acessos_gestor on public.sc_acessos
for all to authenticated
using ((select public.sc_is_manager()))
with check ((select public.sc_is_manager()));
create policy sc_unidades_gestor on public.sc_acesso_unidades
for all to authenticated
using ((select public.sc_is_manager()))
with check ((select public.sc_is_manager()));
create policy sc_escopos_gestor on public.sc_clientes_escopos
for all to authenticated
using ((select public.sc_is_manager()))
with check ((select public.sc_is_manager()));

-- RESTRICTIVE aplica AND às políticas permissivas existentes.
-- Não apagar políticas antigas, não ampliar grants e não habilitar exclusões.
create policy sc_gestor_provisorio on public.crm_perfis
as restrictive for all to authenticated
using ((select public.sc_is_manager()))
with check ((select public.sc_is_manager()));
create policy sc_gestor_provisorio on public.crm_contatos
as restrictive for all to authenticated
using ((select public.sc_is_manager()))
with check ((select public.sc_is_manager()));
create policy sc_gestor_provisorio on public.crm_metadados
as restrictive for all to authenticated
using ((select public.sc_is_manager()))
with check ((select public.sc_is_manager()));
create policy sc_gestor_provisorio on public.vistorias
as restrictive for all to authenticated
using ((select public.sc_is_manager()))
with check ((select public.sc_is_manager()));

-- Restringir apenas vistoria-media; não interferir em outros buckets.
create policy sc_vistoria_media_gestor_provisorio on storage.objects
as restrictive for all to authenticated
using (bucket_id <> 'vistoria-media' or (select public.sc_is_manager()))
with check (bucket_id <> 'vistoria-media' or (select public.sc_is_manager()));

commit;

-- Depois: verificar via sessão JWT do gestor e usuário fictício sem função.
-- SQL Editor como postgres não valida a autorização efetiva da API.
-- Não remover o bloqueio para resolver erro de sessão: diagnosticar antes.
