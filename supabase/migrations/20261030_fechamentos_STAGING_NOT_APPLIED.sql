-- NÃO APLICADA. Apenas Solar Clean testes crm / zzphucuiqhzrilrddxnf.
-- Confirmar projeto no painel antes da execução manual. Não executar em produção.
-- Pré-requisitos: estrutura, gestor e agenda já instalados. Sem dados de exemplo.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.sc_fechamentos (
  id uuid primary key,
  parceiro_id uuid not null references public.sc_parceiros(id),
  parceiro_nome text not null,
  unidade text not null check (unidade in ('RS','SC')),
  competencia date not null check (extract(day from competencia)=1),
  status text not null default 'Fechado' check (status in ('Fechado','Cancelado')),
  total_centavos bigint not null check (total_centavos between 1 and 9007199254740991),
  anterior_centavos bigint not null check (anterior_centavos between 0 and total_centavos),
  pedido_itens jsonb not null check (jsonb_typeof(pedido_itens)='array'),
  criado_por uuid not null references auth.users(id),
  criado_em timestamptz not null default clock_timestamp(),
  cancelado_por uuid references auth.users(id),
  cancelado_em timestamptz,
  motivo_cancelamento text,
  check ((status='Fechado' and cancelado_em is null and cancelado_por is null and motivo_cancelamento is null)
    or (status='Cancelado' and cancelado_em is not null and cancelado_por is not null and length(btrim(motivo_cancelamento)) between 3 and 500))
);
create index sc_fechamentos_competencia_idx on public.sc_fechamentos(unidade,parceiro_id,competencia,id);

create table public.sc_fechamento_itens (
  fechamento_id uuid not null references public.sc_fechamentos(id),
  agenda_id uuid not null references public.agenda_eventos(id),
  revision_base bigint not null check (revision_base>0),
  cliente text not null,
  data_agendada date not null,
  cobrado_centavos bigint not null check (cobrado_centavos between 1 and 9007199254740991),
  anterior_centavos bigint not null check (anterior_centavos between 0 and cobrado_centavos),
  ativo boolean not null default true,
  primary key (fechamento_id,agenda_id)
);
-- A unicidade persiste entre sessões e dispositivos; cancelamento libera o serviço.
create unique index sc_fechamento_servico_ativo_key on public.sc_fechamento_itens(agenda_id) where ativo;

create table public.sc_fechamento_recebimentos (
  id uuid primary key,
  fechamento_id uuid not null references public.sc_fechamentos(id),
  valor_centavos bigint not null check (valor_centavos between 1 and 9007199254740991),
  data_recebimento date not null,
  forma text not null check (forma in ('Pix','Dinheiro','Cartão','Transferência','Outro')),
  criado_por uuid not null references auth.users(id),
  criado_em timestamptz not null default clock_timestamp()
);
create index sc_recebimentos_fechamento_idx on public.sc_fechamento_recebimentos(fechamento_id,id);

alter table public.sc_fechamentos enable row level security;
alter table public.sc_fechamento_itens enable row level security;
alter table public.sc_fechamento_recebimentos enable row level security;
revoke all on public.sc_fechamentos,public.sc_fechamento_itens,public.sc_fechamento_recebimentos from public,anon,authenticated;
grant select on public.sc_fechamentos,public.sc_fechamento_itens,public.sc_fechamento_recebimentos to authenticated;
create policy sc_fechamentos_ler_gestor on public.sc_fechamentos for select to authenticated using ((select public.sc_is_manager()));
create policy sc_fechamento_itens_ler_gestor on public.sc_fechamento_itens for select to authenticated using ((select public.sc_is_manager()));
create policy sc_recebimentos_ler_gestor on public.sc_fechamento_recebimentos for select to authenticated using ((select public.sc_is_manager()));

-- Retorno idêntico para criação e reenvio, sem efeitos na agenda/pagamento_status.
create function public.sc_fechamento_resultado(p_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',f.id,'status',f.status,'total_centavos',f.total_centavos,
   'anterior_centavos',f.anterior_centavos,
   'recebimentos_centavos',coalesce((select sum(r.valor_centavos) from public.sc_fechamento_recebimentos r where r.fechamento_id=f.id),0),
   'saldo_centavos',f.total_centavos-f.anterior_centavos-coalesce((select sum(r.valor_centavos) from public.sc_fechamento_recebimentos r where r.fechamento_id=f.id),0))
 from public.sc_fechamentos f where f.id=p_id;
$$;
revoke all on function public.sc_fechamento_resultado(uuid) from public,anon,authenticated;

create function public.sc_criar_fechamento(p_id uuid,p_parceiro uuid,p_unidade text,p_competencia date,p_itens jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_pedido jsonb; v_count integer; v_distinct integer; v_row record; v_old public.sc_fechamentos%rowtype;
 v_total bigint:=0; v_anterior bigint:=0; v_locked integer:=0;
begin
 if not coalesce(public.sc_is_manager(),false) or auth.uid() is null then raise exception 'Acesso restrito ao gestor' using errcode='42501'; end if;
 if p_id is null or p_parceiro is null or p_unidade is null or p_unidade not in ('RS','SC') or p_competencia is null or extract(day from p_competencia)<>1 then raise exception 'Identificação, parceiro, unidade ou competência inválida'; end if;
 if p_itens is null or jsonb_typeof(p_itens)<>'array' then raise exception 'Itens inválidos'; end if;
 if jsonb_array_length(p_itens) not between 1 and 500 then raise exception 'Informe de 1 a 500 serviços'; end if;
 -- A entrada só identifica linhas e revisões. Preços são lidos do banco bloqueado.
 select count(*),count(distinct x.id),jsonb_agg(jsonb_build_object('id',x.id,'revision',x.revision) order by x.id)
 into v_count,v_distinct,v_pedido
 from jsonb_to_recordset(p_itens) x(id uuid,revision bigint);
 if v_count<>v_distinct or exists(select 1 from jsonb_to_recordset(v_pedido) x(id uuid,revision bigint) where x.id is null or x.revision is null or x.revision<1) then raise exception 'Serviços duplicados ou revisão inválida'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into v_old from public.sc_fechamentos where id=p_id for update;
 if found then
   if v_old.parceiro_id<>p_parceiro or v_old.unidade<>p_unidade or v_old.competencia<>p_competencia or v_old.pedido_itens<>v_pedido then raise exception 'ID já usado com outro conteúdo'; end if;
   return public.sc_fechamento_resultado(p_id);
 end if;
 perform 1 from public.sc_parceiros where id=p_parceiro and ativo for share;
 if not found then raise exception 'Parceiro ausente ou inativo'; end if;
 -- Ordem fixa evita inversão de bloqueios em fechamentos concorrentes.
 for v_row in
   select a.*,x.revision as revisao_pedida from public.agenda_eventos a
   join jsonb_to_recordset(v_pedido) x(id uuid,revision bigint) on x.id=a.id
   order by a.id for update of a
 loop
   v_locked:=v_locked+1;
   if v_row.revision<>v_row.revisao_pedida then raise exception 'Serviço alterado: confira novamente'; end if;
   if v_row.unidade<>p_unidade or v_row.status<>'Concluído' or v_row.arquivado_em is not null
      or date_trunc('month',v_row.data)::date<>p_competencia then raise exception 'Serviço fora da unidade, mês ou situação elegível'; end if;
   -- Bloqueia a origem durante a conferência, mesmo com escrita administrativa concorrente.
   perform 1 from public.sc_clientes_escopos e where e.id=v_row.sc_escopo_id and e.unidade=p_unidade and e.parceiro_id=p_parceiro for share;
   if not found then raise exception 'Serviço não pertence ao parceiro'; end if;
   if v_row.valor_cobrado<=0 or v_row.valor_recebido>v_row.valor_cobrado then raise exception 'Revise cobrado e recebido do serviço'; end if;
   if exists(select 1 from public.sc_fechamento_itens i where i.agenda_id=v_row.id and i.ativo) then raise exception 'Serviço já pertence a fechamento ativo'; end if;
   v_total:=v_total+(v_row.valor_cobrado*100)::bigint;
   v_anterior:=v_anterior+(v_row.valor_recebido*100)::bigint;
   if v_total>9007199254740991 then raise exception 'Total fora do limite'; end if;
 end loop;
 if v_locked<>v_count then raise exception 'Serviço não encontrado'; end if;
 insert into public.sc_fechamentos(id,parceiro_id,parceiro_nome,unidade,competencia,total_centavos,anterior_centavos,pedido_itens,criado_por)
 select p_id,p_parceiro,p.nome,p_unidade,p_competencia,v_total,v_anterior,v_pedido,auth.uid() from public.sc_parceiros p where p.id=p_parceiro;
 insert into public.sc_fechamento_itens(fechamento_id,agenda_id,revision_base,cliente,data_agendada,cobrado_centavos,anterior_centavos)
 select p_id,a.id,a.revision,a.cliente,a.data,(a.valor_cobrado*100)::bigint,(a.valor_recebido*100)::bigint
 from public.agenda_eventos a join jsonb_to_recordset(v_pedido) x(id uuid,revision bigint) on x.id=a.id;
 return public.sc_fechamento_resultado(p_id);
end;
$$;
revoke all on function public.sc_criar_fechamento(uuid,uuid,text,date,jsonb) from public,anon,authenticated;
grant execute on function public.sc_criar_fechamento(uuid,uuid,text,date,jsonb) to authenticated;

create function public.sc_registrar_recebimento(p_id uuid,p_fechamento uuid,p_centavos bigint,p_data date,p_forma text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_f public.sc_fechamentos%rowtype; v_r public.sc_fechamento_recebimentos%rowtype; v_recebido numeric;
begin
 if not coalesce(public.sc_is_manager(),false) or auth.uid() is null then raise exception 'Acesso restrito ao gestor' using errcode='42501'; end if;
 if p_id is null or p_fechamento is null or p_centavos is null or p_centavos not between 1 and 9007199254740991 or p_data is null or p_forma is null or p_forma not in ('Pix','Dinheiro','Cartão','Transferência','Outro') then raise exception 'Recebimento inválido'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,1));
 select * into v_f from public.sc_fechamentos where id=p_fechamento for update;
 if not found then raise exception 'Fechamento não encontrado'; end if;
 select * into v_r from public.sc_fechamento_recebimentos where id=p_id;
 if found then
   if v_r.fechamento_id<>p_fechamento or v_r.valor_centavos<>p_centavos or v_r.data_recebimento<>p_data or v_r.forma<>p_forma then raise exception 'ID de recebimento já usado com outro conteúdo'; end if;
   return public.sc_fechamento_resultado(p_fechamento);
 end if;
 if v_f.status<>'Fechado' then raise exception 'Fechamento cancelado'; end if;
 select coalesce(sum(valor_centavos),0) into v_recebido from public.sc_fechamento_recebimentos where fechamento_id=p_fechamento;
 if p_centavos>v_f.total_centavos-v_f.anterior_centavos-v_recebido then raise exception 'Recebimento excede o saldo'; end if;
 insert into public.sc_fechamento_recebimentos(id,fechamento_id,valor_centavos,data_recebimento,forma,criado_por)
 values(p_id,p_fechamento,p_centavos,p_data,p_forma,auth.uid());
 return public.sc_fechamento_resultado(p_fechamento);
end;
$$;
revoke all on function public.sc_registrar_recebimento(uuid,uuid,bigint,date,text) from public,anon,authenticated;
grant execute on function public.sc_registrar_recebimento(uuid,uuid,bigint,date,text) to authenticated;

create function public.sc_cancelar_fechamento(p_id uuid,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_f public.sc_fechamentos%rowtype;
begin
 if not coalesce(public.sc_is_manager(),false) or auth.uid() is null then raise exception 'Acesso restrito ao gestor' using errcode='42501'; end if;
 if p_motivo is null or length(btrim(p_motivo)) not between 3 and 500 then raise exception 'Informe motivo de 3 a 500 caracteres'; end if;
 select * into v_f from public.sc_fechamentos where id=p_id for update;
 if not found then raise exception 'Fechamento não encontrado'; end if;
 if v_f.status='Cancelado' then
   if v_f.motivo_cancelamento<>btrim(p_motivo) then raise exception 'Cancelamento já registrado com outro motivo'; end if;
   return public.sc_fechamento_resultado(p_id);
 end if;
 if exists(select 1 from public.sc_fechamento_recebimentos where fechamento_id=p_id) then raise exception 'Fechamento com recebimento exige fluxo de estorno, ainda indisponível'; end if;
 update public.sc_fechamento_itens set ativo=false where fechamento_id=p_id;
 update public.sc_fechamentos set status='Cancelado',cancelado_por=auth.uid(),cancelado_em=clock_timestamp(),motivo_cancelamento=btrim(p_motivo) where id=p_id;
 return public.sc_fechamento_resultado(p_id);
end;
$$;
revoke all on function public.sc_cancelar_fechamento(uuid,text) from public,anon,authenticated;
grant execute on function public.sc_cancelar_fechamento(uuid,text) to authenticated;

-- Um serviço fechado conserva os dados financeiros e a identidade conferidos.
-- O trigger não confia em flags de cliente, GUC ou papel fornecido no payload.
create function public.sc_agenda_fechada_guard()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.valor_cobrado,new.valor_recebido,new.valor_servico,new.gasto_extra,new.pagamento_status,new.pagamento_forma,new.status,new.data,new.unidade,new.sc_escopo_id,new.arquivado_em,new.cliente)
 is distinct from
 (old.valor_cobrado,old.valor_recebido,old.valor_servico,old.gasto_extra,old.pagamento_status,old.pagamento_forma,old.status,old.data,old.unidade,old.sc_escopo_id,old.arquivado_em,old.cliente)
 and exists(select 1 from public.sc_fechamento_itens i where i.agenda_id=old.id and i.ativo) then
   raise exception 'Serviço vinculado a fechamento: dados financeiros e classificação estão bloqueados';
 end if;
 return new;
end;
$$;
revoke all on function public.sc_agenda_fechada_guard() from public,anon,authenticated;
create trigger sc_agenda_fechada_guard before update on public.agenda_eventos for each row execute function public.sc_agenda_fechada_guard();

-- A alteração da origem na tabela de escopos também respeita o fechamento.
create function public.sc_escopo_fechado_guard()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.unidade,new.parceiro_id) is distinct from (old.unidade,old.parceiro_id)
 and exists(select 1 from public.agenda_eventos a join public.sc_fechamento_itens i on i.agenda_id=a.id and i.ativo where a.sc_escopo_id=old.id) then
   raise exception 'Origem vinculada a fechamento ativo';
 end if;
 return new;
end;
$$;
revoke all on function public.sc_escopo_fechado_guard() from public,anon,authenticated;
create trigger sc_escopo_fechado_guard before update on public.sc_clientes_escopos for each row execute function public.sc_escopo_fechado_guard();
alter function public.sc_escopo_fechado_guard() owner to postgres;

-- Dono privilegiado explícito; EXECUTE público foi revogado em todas as funções.
alter function public.sc_fechamento_resultado(uuid) owner to postgres;
alter function public.sc_criar_fechamento(uuid,uuid,text,date,jsonb) owner to postgres;
alter function public.sc_registrar_recebimento(uuid,uuid,bigint,date,text) owner to postgres;
alter function public.sc_cancelar_fechamento(uuid,text) owner to postgres;
alter function public.sc_agenda_fechada_guard() owner to postgres;
commit;
-- Não altera valores, status de pagamento ou serviços existentes na instalação.
-- Recebimentos do fechamento são um livro separado; não aplicar baixa na agenda em lote.
