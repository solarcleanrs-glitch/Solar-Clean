-- STAGING ONLY. Transitional restriction: do not onboard field/partner accounts
-- until scoped report/media/CRM endpoints and their interfaces are validated.
-- Restrictive policies AND the existing permissive policies; never widen access.
do $guard$
begin
 if exists(select 1 from pg_class c where c.oid in (
   'public.vistorias'::regclass,'public.crm_perfis'::regclass,
   'public.crm_metadados'::regclass,'public.crm_contatos'::regclass,
   'storage.objects'::regclass) and not c.relrowsecurity) then
   raise exception 'RLS must already be enabled before restricting legacy paths';
 end if;
end $guard$;

create policy sc_vistorias_legacy_guard on public.vistorias
 as restrictive for all to authenticated
 using ((select public.sc_is_manager()))
 with check ((select public.sc_is_manager()));
create policy sc_crm_perfis_legacy_guard on public.crm_perfis
 as restrictive for all to authenticated
 using ((select public.sc_is_manager()))
 with check ((select public.sc_is_manager()));
create policy sc_crm_metadados_legacy_guard on public.crm_metadados
 as restrictive for all to authenticated
 using ((select public.sc_is_manager()))
 with check ((select public.sc_is_manager()));
create policy sc_crm_contatos_legacy_guard on public.crm_contatos
 as restrictive for all to authenticated
 using ((select public.sc_is_manager()))
 with check ((select public.sc_is_manager()));

-- Other buckets still depend on their existing policies; this adds no grant.
create policy sc_vistoria_media_legacy_guard on storage.objects
 as restrictive for all to authenticated
 using (bucket_id <> 'vistoria-media' or (select public.sc_is_manager()))
 with check (bucket_id <> 'vistoria-media' or (select public.sc_is_manager()));

-- Rollback is policy-only (no data deletion): after review, remove exactly the
-- five policies above. Never disable RLS or remove the older policies blindly.
