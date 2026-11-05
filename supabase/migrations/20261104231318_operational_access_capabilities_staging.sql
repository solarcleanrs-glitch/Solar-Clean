-- CANDIDATE, NOT APPLIED. Requires the unit-manager candidate first.
-- Identity/roles come only from the authenticated server context and access tables.
begin;
create function sc_private.acesso_operacional() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();role_name text;partner uuid;units text[];manager boolean;operational boolean;permissions jsonb;
begin
 if actor is null then raise exception 'Autenticação necessária' using errcode='42501';end if;
 select a.papel,a.parceiro_id into role_name,partner from public.sc_acessos a
 join public.crm_usuarios c on c.user_id=a.user_id where a.user_id=actor and a.ativo;
 if role_name is null then raise exception 'Acesso não autorizado' using errcode='42501';end if;
 if role_name='parceiro' and not exists(select 1 from public.sc_parceiros where id=partner and ativo) then
  raise exception 'Parceiro inativo' using errcode='42501';end if;
 if role_name='gestor' then units:=array['RS','SC']::text[];
 else select coalesce(array_agg(unidade order by unidade),array[]::text[]) into units
  from public.sc_acesso_unidades where user_id=actor;end if;
 manager:=role_name in ('gestor','gestor_unidade') and cardinality(units)>0;
 operational:=role_name in ('gestor','gestor_unidade','tecnico','parceiro') and cardinality(units)>0;
 permissions:=jsonb_build_object('agenda_read',operational,'agenda_manage',manager,
   'reports_read',operational,'visits_write',manager,'crm',manager,'finance',manager,
   'admin',manager,'clients_read',operational and role_name<>'tecnico','access_admin',role_name='gestor');
 return jsonb_build_object('version',1,'actor',actor,'role',role_name,'units',to_jsonb(units),
  'revision',md5(role_name||':'||array_to_string(units,',')||':'||coalesce(partner::text,'')||':'||permissions::text),
  'capabilities',permissions);
end $$;
revoke all on function sc_private.acesso_operacional() from public,anon,authenticated;
grant execute on function sc_private.acesso_operacional() to authenticated;
create function public.sc_acesso_operacional() returns jsonb
language sql stable security invoker set search_path='' as $$select sc_private.acesso_operacional()$$;
revoke all on function public.sc_acesso_operacional() from public,anon,authenticated;
grant execute on function public.sc_acesso_operacional() to authenticated;

-- A technician's client details come from their agenda/report, not an independent
-- imported-client catalogue. Do not rely on hiding that catalogue in the UI.
do $$declare definition text;patched text;begin
 definition:=pg_get_functiondef('sc_private.clientes_campo(text,text)'::regprocedure);
 patched:=replace(definition,$old$access_role not in ('gestor','gestor_unidade','tecnico','parceiro')$old$,
  $new$access_role not in ('gestor','gestor_unidade','parceiro')$new$);
 if definition=patched then raise exception 'Client capability source drift';end if;execute patched;
end $$;
commit;
