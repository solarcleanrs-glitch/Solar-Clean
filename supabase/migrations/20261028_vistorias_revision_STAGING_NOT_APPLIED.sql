-- SOMENTE HOMOLOGAÇÃO: Solar Clean testes crm
-- NÃO EXECUTAR ANTES DE VALIDAR O CLIENTE DE TESTES E AUTORIZAR A MIGRAÇÃO.
-- A transação inteira é revertida em caso de erro.
begin;
alter table public.vistorias add column if not exists revision bigint not null default 1;
create or replace function public.vistorias_revision_on_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- A revisão é exclusiva do servidor, inclusive para o cliente antigo.
  new.revision := old.revision + 1;
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;
drop trigger if exists vistorias_revision_update on public.vistorias;
create trigger vistorias_revision_update
before update on public.vistorias
for each row
execute function public.vistorias_revision_on_update();
commit;

-- Integração futura (NÃO É SQL EXECUTÁVEL):
-- Para editar: PATCH /rest/v1/vistorias?client_uuid=eq.<uuid>&revision=eq.<baseRevision>&select=client_uuid,revision,updated_at
-- Header: Prefer: return=representation
-- Payload: apenas campos editáveis; nunca enviar revision.
-- Exigir resposta com exatamente 1 linha e revision > baseRevision.
-- Resposta [] (2xx) = conflito ou falta de autorização; manter rascunho local.
-- Para criar: POST sem upsert; UUID repetido = conflito; nunca sobrescrever.
-- ATENÇÃO: clientes antigos usando UPSERT continuam inseguros até migrar para PATCH condicionado.
