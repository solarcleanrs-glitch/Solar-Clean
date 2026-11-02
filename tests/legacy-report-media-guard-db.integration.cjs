'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
(async()=>{
 const db=new PGlite(),manager='11111111-1111-4111-8111-111111111111',tech='22222222-2222-4222-8222-222222222222';
 await db.exec(`create role authenticated;create schema auth;create schema storage;
  create function auth.uid() returns uuid language sql stable as
   $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth,storage to authenticated;
  create table sc_acessos(user_id uuid primary key,papel text,ativo boolean);
  create function sc_is_manager() returns boolean language sql stable security definer set search_path='' as
   $$select exists(select 1 from public.sc_acessos where user_id=auth.uid() and papel='gestor' and ativo)$$;
  revoke all on function sc_is_manager() from public;grant execute on function sc_is_manager() to authenticated;
  create table storage.objects(id text primary key,bucket_id text,name text);
  insert into storage.objects values('photo','vistoria-media','synthetic/photo.jpg'),('other','other-bucket','other.jpg');
 `);
 for(const table of ['vistorias','crm_perfis','crm_metadados','crm_contatos'])await db.exec(`
  create table public.${table}(id text primary key,private_value text);
  insert into public.${table} values('original','preserved');
 `);
 const tables=['public.vistorias','public.crm_perfis','public.crm_metadados','public.crm_contatos','storage.objects'];
 for(const t of tables)await db.exec(`alter table ${t} enable row level security;
  grant select,insert,update,delete on ${t} to authenticated;
  create policy old_team on ${t} for all to authenticated using(true) with check(true);`);
 await db.query("insert into sc_acessos values($1,'gestor',true),($2,'tecnico',true)",[manager,tech]);
 const asUser=async actor=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);await db.exec('set role authenticated');};
 await asUser(tech);assert.equal((await db.query('select count(*)::int n from vistorias')).rows[0].n,1,'legacy permissive path reproduced');
 await db.exec('reset role');
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261102225941_restrict_legacy_report_media_paths_staging.sql'),'utf8'));
 await asUser(tech);
 for(const t of tables.slice(0,4)){
  assert.equal((await db.query(`select count(*)::int n from ${t}`)).rows[0].n,0,'permissive policy cannot bypass restriction');
  await assert.rejects(db.exec(`insert into ${t} values('attack','private')`),/row-level security/);
  assert.equal((await db.query(`update ${t} set private_value='attack' returning id`)).rows.length,0);
  assert.equal((await db.query(`delete from ${t} returning id`)).rows.length,0);
 }
 assert.deepEqual((await db.query('select id from storage.objects')).rows,[{id:'other'}],'other bucket retains previous policy');
 await assert.rejects(db.exec("insert into storage.objects values('attack','vistoria-media','x')"),/row-level security/);
 await assert.rejects(db.exec("update storage.objects set bucket_id='vistoria-media' where id='other'"),/row-level security/,'cannot move object into protected bucket');
 await asUser(manager);
 for(const t of tables.slice(0,4)){
  assert.equal((await db.query(`select count(*)::int n from ${t}`)).rows[0].n,1);
  await db.exec(`insert into ${t} values('manager-write','allowed');delete from ${t} where id='manager-write'`);
 }
 assert.equal((await db.query("select count(*)::int n from storage.objects where bucket_id='vistoria-media'")).rows[0].n,1);
 await db.exec('reset role');await db.query('update sc_acessos set ativo=false where user_id=$1',[manager]);await asUser(manager);
 assert.equal((await db.query('select count(*)::int n from vistorias')).rows[0].n,0,'revocation overrides old policy');
 await db.exec('reset role');
 for(const t of tables.slice(0,4))assert.deepEqual((await db.query(`select * from ${t}`)).rows,[{id:'original',private_value:'preserved'}]);
 await db.close();console.log('PASS: restrictive legacy guards block bypass/read/write/reassignment, preserve active manager and other buckets, enforce revocation, preserve original data');
})().catch(e=>{console.error(e);process.exit(1)});
