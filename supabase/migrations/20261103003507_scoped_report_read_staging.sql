-- STAGING ONLY. Read projection and authorized report photos; no field writes.
-- No account is registered or activated. Legacy direct report/CRM guards remain.
create function sc_private.relatorio_campo(p_vistoria uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); access_role text; partner uuid; v public.vistorias%rowtype;
 result jsonb; photos jsonb;
begin
 if actor is null then raise exception 'Autenticação necessária' using errcode='42501';end if;
 select a.papel,a.parceiro_id into access_role,partner from public.sc_acessos a
 join public.crm_usuarios u on u.user_id=a.user_id where a.user_id=actor and a.ativo;
 if access_role is null or access_role not in ('gestor','tecnico','parceiro') then
  raise exception 'Acesso operacional não autorizado' using errcode='42501';end if;
 select x.* into v from public.vistorias x where x.client_uuid=p_vistoria and (
  access_role='gestor' or exists(
   select 1 from public.sc_clientes_escopos s
   join public.sc_acesso_unidades au on au.unidade=s.unidade and au.user_id=actor
   where s.id=x.sc_escopo_id and (access_role='tecnico' or (
    access_role='parceiro' and s.parceiro_id=partner and exists(
     select 1 from public.sc_parceiros p where p.id=partner and p.ativo)))));
 -- Same response for an absent record and a record outside the caller's scope.
 if not found then return null;end if;
 select jsonb_object_agg(j.key,j.value) into result from jsonb_each(to_jsonb(v)) j
 where j.key=any(array['client_uuid','created_at','updated_at','cliente','telefone',
 'cidade','endereco','placas','pot_placa','marca_placa','marca_inv','modelo_inv',
 'ano_inst','telhado','sujeira','sujidades','estrutura','dps','qtd_dps','modelo_dps',
 'inv_status','inv_internet','erro_inv','show_generation','antes','depois','pct',
 'limpeza','retorno','tecnico']);
 -- Never serialize the complete row or raw manifest to the client. Unknown
 -- categories and internal files fail closed until explicitly reviewed.
 select coalesce(jsonb_agg(jsonb_build_object('name',p->>'name','type',p->>'type',
  'category',p->>'category','storagePath',p->>'storagePath') order by ord),'[]'::jsonb)
 into photos from jsonb_array_elements(case when jsonb_typeof(v.media_manifest)='array'
  then v.media_manifest else '[]'::jsonb end) with ordinality as photo(p,ord)
 where p->>'category' in ('Antes','Depois','Telhado','Problema','Foto')
  and p->>'type' in ('image/jpeg','image/png','image/webp')
  and left(p->>'storagePath',37)=v.client_uuid::text||'/'
  and position('..' in p->>'storagePath')=0;
 return result||jsonb_build_object('media_manifest',photos);
end $$;
revoke all on function sc_private.relatorio_campo(uuid) from public,anon,authenticated;
grant execute on function sc_private.relatorio_campo(uuid) to authenticated;
create function public.sc_relatorio_campo(p_vistoria uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select sc_private.relatorio_campo(p_vistoria);
$$;
revoke all on function public.sc_relatorio_campo(uuid) from public,anon,authenticated;
grant execute on function public.sc_relatorio_campo(uuid) to authenticated;

create function sc_private.report_photo_allowed(p_name text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare report jsonb;
begin
 if p_name is null or split_part(p_name,'/',1) !~
  '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false;end if;
 report:=sc_private.relatorio_campo(split_part(p_name,'/',1)::uuid);
 return exists(select 1 from jsonb_array_elements(coalesce(report->'media_manifest','[]'::jsonb)) p
  where p->>'storagePath'=p_name);
exception when insufficient_privilege then return false;
end $$;
revoke all on function sc_private.report_photo_allowed(text) from public,anon,authenticated;
grant execute on function sc_private.report_photo_allowed(text) to authenticated;

-- Preserve the existing restrictive ALL policy and its manager-only WITH CHECK.
-- Additional command guards ensure a field read can never allow UPDATE/DELETE,
-- including moving a protected photo into an unprotected bucket.
alter policy sc_vistoria_media_legacy_guard on storage.objects
 using(bucket_id<>'vistoria-media' or (select public.sc_is_manager())
  or sc_private.report_photo_allowed(name))
 with check(bucket_id<>'vistoria-media' or (select public.sc_is_manager()));
create policy sc_vistoria_media_update_guard on storage.objects as restrictive
 for update to authenticated using(bucket_id<>'vistoria-media' or (select public.sc_is_manager()))
 with check(bucket_id<>'vistoria-media' or (select public.sc_is_manager()));
create policy sc_vistoria_media_delete_guard on storage.objects as restrictive
 for delete to authenticated using(bucket_id<>'vistoria-media' or (select public.sc_is_manager()));
