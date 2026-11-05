'use strict';
const fs=require('node:fs'),{PGlite}=require('@electric-sql/pglite');
module.exports=async function fixture({textAgenda=false}={}){
 const db=new PGlite(),id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const load=async name=>{try{await db.exec(fs.readFileSync('supabase/migrations/'+name+'.sql','utf8'));}catch(e){throw Error(name+': '+e.message);}};
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage to authenticated;
 create table storage.objects(id text primary key,bucket_id text,name text,metadata jsonb,unique(bucket_id,name));
 alter table storage.objects enable row level security;
 grant select,insert,update,delete on storage.objects to authenticated;
 create policy old_team on storage.objects for all to authenticated using(true) with check(true);`);
 for(const name of ['20261028_crm_contatos_staging','20261028_crm_metadados_staging','20261028_crm_perfis_staging','20261028_vistorias_auth_staging','20261028_vistorias_revision_STAGING_NOT_APPLIED','20261030_access_foundation_STAGING_NOT_APPLIED'])await load(name);
 for(let n=1;n<=3;n++){
 await db.query('insert into auth.users values($1,$2)',[id(n),`synthetic-${n}@example.invalid`]);
 await db.query('insert into crm_usuarios values($1)',[id(n)]);}
 await db.query("select set_config('sc_bootstrap.manager_uuid',$1,false),set_config('sc_bootstrap.manager_email',$2,false)",[id(1),'synthetic-1@example.invalid']);
 for(const name of ['20261030_manager_gate_STAGING_NOT_APPLIED','20261030_agenda_eventos_STAGING_NOT_APPLIED','20261030_fechamentos_STAGING_NOT_APPLIED','20261031_clientes_historico_STAGING_NOT_APPLIED','20261102220102_scoped_field_agenda_read_staging','20261102225941_restrict_legacy_report_media_paths_staging','20261103003507_scoped_report_read_staging','20261103004245_scoped_report_list_staging','20261103011052_scoped_imported_clients_read_staging','20261103013039_imported_client_contact_history_staging','20261104014308_imported_client_edit_staging','20261104192519_field_agenda_status_staging','20261104222525_unit_manager_permissions_staging','20261104231318_operational_access_capabilities_staging'])await load(name);

 if(textAgenda)await db.exec(`alter table sc_fechamento_itens drop constraint sc_fechamento_itens_agenda_id_fkey;
 alter table agenda_eventos alter column id drop default;alter table agenda_eventos alter column id type text using id::text;
 alter table sc_fechamento_itens alter column agenda_id type text using agenda_id::text;
 alter table sc_fechamento_itens add foreign key(agenda_id) references agenda_eventos(id);`);
 await load('20261105002422_field_inspection_write_staging');
 const as=async n=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[n?id(n):'']);await db.exec('set role authenticated');};
 return {db,id,as};
};
