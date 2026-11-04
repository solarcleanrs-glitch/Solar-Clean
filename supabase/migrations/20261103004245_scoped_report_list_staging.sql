-- STAGING ONLY. Summary list for the scoped technical report interface.
create function sc_private.relatorios_campo(p_inicio date,p_fim date,p_unidade text default null)
returns table(client_uuid uuid,cliente text,created_at timestamptz,unidade text)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.sc_acessos a
  join public.crm_usuarios u on u.user_id=a.user_id where a.user_id=auth.uid()
  and a.ativo and a.papel in ('gestor','tecnico','parceiro')) then
  raise exception 'Acesso operacional não autorizado' using errcode='42501';end if;
 if p_inicio is null or p_fim is null or p_fim<p_inicio or p_fim-p_inicio>92
  or (p_unidade is not null and p_unidade not in ('RS','SC')) then
  raise exception 'Informe período de até 93 dias e unidade válida' using errcode='22023';end if;
 return query select v.client_uuid,v.cliente,v.created_at,s.unidade
 from public.vistorias v left join public.sc_clientes_escopos s on s.id=v.sc_escopo_id
 where v.created_at>=(p_inicio::timestamp at time zone 'America/Sao_Paulo')
 and v.created_at<((p_fim+1)::timestamp at time zone 'America/Sao_Paulo')
 and (p_unidade is null or s.unidade=p_unidade)
 and sc_private.relatorio_campo(v.client_uuid) is not null
 order by v.created_at,v.client_uuid;
end $$;
revoke all on function sc_private.relatorios_campo(date,date,text) from public,anon,authenticated;
grant execute on function sc_private.relatorios_campo(date,date,text) to authenticated;
create function public.sc_relatorios_campo(p_inicio date,p_fim date,p_unidade text default null)
returns table(client_uuid uuid,cliente text,created_at timestamptz,unidade text)
language sql stable security invoker set search_path='' as $$
 select * from sc_private.relatorios_campo(p_inicio,p_fim,p_unidade);
$$;
revoke all on function public.sc_relatorios_campo(date,date,text) from public,anon,authenticated;
grant execute on function public.sc_relatorios_campo(date,date,text) to authenticated;
