-- Somente leitura. Executar no SQL Editor do projeto Solar Clean testes crm.
-- Não é um backup nem demonstra restauração. Retorna só contagens.
select jsonb_build_object(
  'fechamentos', (select count(*) from public.sc_fechamentos),
  'recebimentos', (select count(*) from public.sc_fechamento_recebimentos),
  'totais_divergentes', (
    select count(*) from public.sc_fechamentos f
    where f.total_centavos <> coalesce((select sum(i.cobrado_centavos) from public.sc_fechamento_itens i where i.fechamento_id=f.id),0)
       or f.anterior_centavos <> coalesce((select sum(i.anterior_centavos) from public.sc_fechamento_itens i where i.fechamento_id=f.id),0)
  ),
  'recebimentos_acima_do_saldo', (
    select count(*) from public.sc_fechamentos f
    where f.anterior_centavos + coalesce((select sum(r.valor_centavos) from public.sc_fechamento_recebimentos r where r.fechamento_id=f.id),0) > f.total_centavos
  ),
  'vinculos_com_status_incorreto', (
    select count(*) from public.sc_fechamento_itens i
    join public.sc_fechamentos f on f.id=i.fechamento_id
    where i.ativo <> (f.status='Fechado')
  ),
  'servicos_com_mais_de_um_vinculo_ativo', (
    select count(*) from (
      select agenda_id from public.sc_fechamento_itens
      where ativo group by agenda_id having count(*)>1
    ) duplicados
  )
) as integridade;
