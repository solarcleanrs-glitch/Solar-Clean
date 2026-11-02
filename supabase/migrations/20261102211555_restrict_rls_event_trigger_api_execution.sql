-- Reviewed for Solar Clean testes crm only. Do not apply to production as
-- part of this test release. No customer rows or application RPCs are changed.
do $guard$
begin
 if not exists (
  select 1 from pg_proc p
  join pg_event_trigger e on e.evtfoid=p.oid
  where p.oid='public.rls_auto_enable()'::regprocedure
    and p.prorettype='pg_catalog.event_trigger'::regtype
    and pg_get_userbyid(p.proowner)='postgres'
    and pg_get_userbyid(e.evtowner)='postgres'
    and e.evtname='ensure_rls' and e.evtenabled='O'
 ) then raise exception 'Unexpected RLS event trigger configuration; review before changing privileges.';
 end if;
end $guard$;

revoke execute on function public.rls_auto_enable() from public,anon,authenticated;

do $verify$
begin
 if has_function_privilege('anon','public.rls_auto_enable()','EXECUTE')
    or has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE')
    or not has_function_privilege('postgres','public.rls_auto_enable()','EXECUTE') then
  raise exception 'Unexpected execution privileges after restriction.';
 end if;
end $verify$;
