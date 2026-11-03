-- STAGING ONLY. Imported contact read projection; never merge legacy clients
-- by name/phone and never expose raw calendar events or internal CRM notes.
create function sc_private.clientes_campo(p_unidade text default null,p_busca text default '')
returns table(id uuid,cliente text,telefone text,cidade text,endereco text,unidade text,origem text)
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();access_role text;partner uuid;
begin
 if actor is null then raise exception 'Autenticação necessária' using errcode='42501';end if;
 select a.papel,a.parceiro_id into access_role,partner from public.sc_acessos a
 join public.crm_usuarios u on u.user_id=a.user_id where a.user_id=actor and a.ativo;
 if access_role is null or access_role not in ('gestor','tecnico','parceiro') then
  raise exception 'Acesso operacional não autorizado' using errcode='42501';end if;
 if (p_unidade is not null and p_unidade not in ('RS','SC')) or p_busca is null or length(p_busca)>100 then
  raise exception 'Unidade ou pesquisa inválida' using errcode='22023';end if;
 return query select c.id,c.cliente,c.telefone,c.cidade,c.endereco,c.unidade,c.origem
 from public.sc_clientes c
 where (p_unidade is null or c.unidade=p_unidade)
 and (p_busca='' or c.cliente ilike '%'||p_busca||'%' or c.telefone ilike '%'||p_busca||'%' or c.cidade ilike '%'||p_busca||'%')
 and (access_role='gestor' or (
  c.origem in ('particular','parceiro')
  and exists(select 1 from public.sc_acesso_unidades au where au.user_id=actor and au.unidade=c.unidade)
  and (access_role='tecnico' or (access_role='parceiro' and c.origem='parceiro'
   and c.parceiro_id=partner and exists(select 1 from public.sc_parceiros p where p.id=partner and p.ativo)))))
 order by c.cliente,c.id;
end $$;
revoke all on function sc_private.clientes_campo(text,text) from public,anon,authenticated;
grant execute on function sc_private.clientes_campo(text,text) to authenticated;
create function public.sc_clientes_campo(p_unidade text default null,p_busca text default '')
returns table(id uuid,cliente text,telefone text,cidade text,endereco text,unidade text,origem text)
language sql stable security invoker set search_path='' as $$
 select * from sc_private.clientes_campo(p_unidade,p_busca);
$$;
revoke all on function public.sc_clientes_campo(text,text) from public,anon,authenticated;
grant execute on function public.sc_clientes_campo(text,text) to authenticated;
