-- PROPOSTA NÃO APLICADA. Exige nova autorização antes de executar.
-- Exclusivamente Solar Clean testes crm / zzphucuiqhzrilrddxnf.
-- Confirmar o ID do projeto no painel; não executar em produção.
-- Pré-requisitos: etapas de estrutura e gestor aplicadas anteriormente.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- A consulta de diagnóstico retornou ausência desta tabela. CREATE TABLE sem
-- IF NOT EXISTS evita aceitar silenciosamente outra estrutura ou execução repetida.
-- O par abaixo permite validar a unidade contra o escopo por chave estrangeira.
alter table public.sc_clientes_escopos
  add constraint sc_clientes_escopos_id_unidade_key unique (id, unidade);

create table public.agenda_eventos (
  id uuid primary key default gen_random_uuid(),
  client_key text not null check (length(btrim(client_key)) > 0),
  cliente text not null check (length(btrim(cliente)) > 0),
  telefone text not null default '',
  cidade text not null default '',
  endereco text not null default '',
  maps_url text not null default '',
  placas integer not null default 0 check (placas >= 0),
  unidade text not null check (unidade in ('RS','SC')),
  -- NULL significa "ainda não classificado", nunca "Particular".
  -- Permitido para compatibilidade com o código de testes anterior.
  sc_escopo_id uuid,
  data date not null,
  hora time without time zone not null,
  duracao_min integer not null default 90 check (duracao_min between 15 and 1440),
  tecnico text not null default '',
  status text not null default 'Agendado' check (status in (
    'Agendado','Em deslocamento','Em atendimento','Concluído','Cancelado'
  )),
  observacao text not null default '',
  valor_servico numeric(14,2) not null default 0 check (valor_servico >= 0),
  gasto_extra numeric(14,2) not null default 0 check (gasto_extra >= 0),
  gasto_extra_obs text not null default '',
  pagamento_status text not null default 'Pendente' check (pagamento_status in ('Pendente','Pago')),
  pagamento_forma text not null default '' check (pagamento_forma in ('','Pix','Dinheiro','Cartão')),
  valor_cobrado numeric(14,2) not null default 0 check (valor_cobrado >= 0),
  valor_recebido numeric(14,2) not null default 0 check (valor_recebido >= 0),
  google_event_id text not null default '',
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  arquivado_em timestamptz,
  constraint agenda_eventos_escopo_unidade_fk
    foreign key (sc_escopo_id, unidade)
    references public.sc_clientes_escopos(id, unidade)
);

create index agenda_eventos_unidade_data_idx
  on public.agenda_eventos(unidade, data, hora, id);
create index agenda_eventos_escopo_idx on public.agenda_eventos(sc_escopo_id);

-- Unidade e parceiro pertencem ao escopo; a agenda não duplica parceiro_id.
-- Uma classificação atribuída não pode ser trocada pelo cliente antigo/UPSERT.
-- Correção futura exige fluxo próprio e histórico, ainda não implementado.
create function public.sc_agenda_guard()
returns trigger
language plpgsql security invoker
set search_path = ''
as $$
begin
  if TG_OP = 'INSERT' then
    new.revision := 1;
    new.created_at := clock_timestamp();
    new.updated_at := new.created_at;
  else
    if new.id is distinct from old.id then
      raise exception 'Identificador de agendamento é imutável';
    end if;
    if old.sc_escopo_id is not null and
       new.sc_escopo_id is distinct from old.sc_escopo_id then
      raise exception 'Classificação existente exige fluxo de correção específico';
    end if;
    new.created_at := old.created_at;
    new.revision := old.revision + 1;
    new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  end if;
  return new;
end;
$$;
revoke all on function public.sc_agenda_guard() from public, anon, authenticated;
create trigger sc_agenda_guard
before insert or update on public.agenda_eventos
for each row execute function public.sc_agenda_guard();

alter table public.agenda_eventos enable row level security;
revoke all on table public.agenda_eventos from public, anon, authenticated;
grant select, insert, update on table public.agenda_eventos to authenticated;

create policy sc_agenda_ler_gestor on public.agenda_eventos
for select to authenticated using ((select public.sc_is_manager()));
create policy sc_agenda_criar_gestor on public.agenda_eventos
for insert to authenticated with check ((select public.sc_is_manager()));
create policy sc_agenda_editar_gestor on public.agenda_eventos
for update to authenticated
using ((select public.sc_is_manager()))
with check ((select public.sc_is_manager()));

-- Somente cadastro de nomes; nenhum preço, cliente, serviço ou recebimento.
insert into public.sc_parceiros (nome) values ('YES'), ('Elysia')
on conflict (nome) do nothing;

commit;

-- Sem DELETE/TRUNCATE na API. Arquivamento reversível via UPDATE será integrado
-- no código de testes. A versão publicada anteriormente ainda não usa esse fluxo.
-- Não executar sincronização Google nem importar histórico como parte deste SQL.
