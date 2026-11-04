'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
(async()=>{
 const db=new PGlite(),id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;create schema sc_private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage,sc_private to authenticated;
 create table crm_usuarios(user_id uuid primary key);
 create table sc_acessos(user_id uuid primary key,papel text,parceiro_id uuid,ativo boolean);
 create table sc_acesso_unidades(user_id uuid,unidade text);
 create table sc_parceiros(id uuid primary key,ativo boolean);
 create table sc_clientes_escopos(id uuid primary key,unidade text,parceiro_id uuid);
 create table vistorias(client_uuid uuid primary key,sc_escopo_id uuid,cliente text,obs text,valor_cobrado numeric,media_manifest jsonb,client_signature text);
 create table storage.objects(name text primary key,bucket_id text);
 create function sc_is_manager() returns boolean language sql stable security definer set search_path='' as
 $$select exists(select 1 from public.sc_acessos where user_id=auth.uid() and papel='gestor' and ativo)$$;
 revoke all on function sc_is_manager() from public;grant execute on function sc_is_manager() to authenticated;
 alter table vistorias enable row level security;grant select on vistorias to authenticated;
 create policy manager_read on vistorias to authenticated using((select sc_is_manager()));
 alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;
 create policy old_team on storage.objects to authenticated using(true) with check(true);
 create policy sc_vistoria_media_legacy_guard on storage.objects as restrictive to authenticated using((select sc_is_manager())) with check((select sc_is_manager()));`);
 for(const [n,role,partner] of [[1,'gestor',null],[2,'tecnico',null],[3,'tecnico',null],[4,'parceiro',id(101)],[5,'parceiro',id(102)],[6,'financeiro',null]]){
  await db.query('insert into crm_usuarios values($1)',[id(n)]);
  await db.query('insert into sc_acessos values($1,$2,$3,true)',[id(n),role,partner]);
 }
 for(const [n,unit] of [[2,'RS'],[3,'SC'],[4,'RS'],[5,'RS']])await db.query('insert into sc_acesso_unidades values($1,$2)',[id(n),unit]);
 await db.query('insert into sc_parceiros values($1,true),($2,true)',[id(101),id(102)]);
 await db.query("insert into sc_clientes_escopos values($1,'RS',$3),($2,'SC',$4)",[id(201),id(202),id(101),id(102)]);
 for(const [n,scope] of [[301,id(201)],[302,id(202)],[303,null]]){
  const photos=[{name:'public',type:'image/jpeg',category:'Antes',storagePath:id(n)+'/before/public.jpg'},
   {name:'internal',type:'image/jpeg',category:'Arquivo interno',storagePath:id(n)+'/internal/private.jpg'},
   {name:'foreign',type:'image/jpeg',category:'Antes',storagePath:id(399)+'/before/foreign.jpg'},
   {name:'traversal',type:'image/jpeg',category:'Antes',storagePath:id(n)+'/../private.jpg'}];
  await db.query("insert into vistorias values($1,$2,'Synthetic','secret',375,$3::jsonb,'private signature')",[id(n),scope,JSON.stringify(photos)]);
  for(const photo of photos.slice(0,2))await db.query("insert into storage.objects values($1,'vistoria-media')",[photo.storagePath]);
 }
 await db.query("insert into storage.objects values($1,'vistoria-media')",[id(301)+'/guessed.jpg']);
 await db.exec("alter table vistorias add column created_at timestamptz;update vistorias set created_at='2026-10-29T02:59:59Z'");
 const baseline=(await db.query('select to_jsonb(v) row from vistorias v order by client_uuid')).rows;
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261103003507_scoped_report_read_staging.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261103004245_scoped_report_list_staging.sql'),'utf8'));
 const asUser=async n=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[n?id(n):'']);await db.exec('set role authenticated');};
 const report=async n=>(await db.query('select sc_relatorio_campo($1) r',[id(n)])).rows[0].r;
 const list=async(unit=null)=>(await db.query("select * from sc_relatorios_campo('2026-10-28','2026-10-28',$1)",[unit])).rows;
 await asUser(1);assert.ok(await report(303),'manager retains unclassified');assert.equal((await list()).length,3);
 assert.equal((await list('RS')).length,1);
 assert.equal((await db.query("select * from sc_relatorios_campo('2026-10-29','2026-10-29',null)")).rows.length,0,'Brazil date boundary');
 for(const n of [2,4]){
  await asUser(n);const r=await report(301);assert.equal(r.cliente,'Synthetic');
  assert.deepEqual((await list()).map(x=>x.client_uuid),[id(301)],'list obeys same scope as report');
  for(const forbidden of ['obs','valor_cobrado','client_signature','sc_escopo_id'])assert.equal(Object.hasOwn(r,forbidden),false);
  assert.equal(r.media_manifest.length,1,'internal, foreign and traversal paths excluded');
  assert.equal(await report(302),null);assert.equal(await report(303),null);assert.equal(await report(999),null);
  assert.equal((await db.query('select count(*)::int n from vistorias')).rows[0].n,0,'RPC does not grant direct table read');
  const photos=(await db.query('select name from storage.objects')).rows;assert.deepEqual(photos,[{name:id(301)+'/before/public.jpg'}]);
  assert.equal((await db.query('delete from storage.objects returning name')).rows.length,0,'read grant cannot delete');
  assert.equal((await db.query("update storage.objects set name='changed' returning name")).rows.length,0,'read grant cannot update');
  assert.equal((await db.query("update storage.objects set bucket_id='other-bucket' returning name")).rows.length,0,'cannot move protected photo to another bucket');
  await assert.rejects(db.exec("insert into storage.objects values('bad','vistoria-media')"),/row-level security/);
 }
 await asUser(3);assert.ok(await report(302));assert.equal(await report(301),null);
 await asUser(5);assert.equal(await report(301),null,'different partner');
 await asUser(6);await assert.rejects(report(301),/não autorizado/);await assert.rejects(list(),/não autorizado/);
 await asUser(99);await assert.rejects(report(301),/não autorizado/);
 await asUser(null);await assert.rejects(report(301),/Autenticação/);
 await db.exec('reset role');await db.query('update sc_acessos set ativo=false where user_id=$1',[id(2)]);
 await asUser(2);await assert.rejects(report(301),/não autorizado/);assert.equal((await db.query('select count(*)::int n from storage.objects')).rows[0].n,0);
 await db.exec('reset role');await db.query('update sc_parceiros set ativo=false where id=$1',[id(101)]);
 await asUser(4);assert.equal(await report(301),null);
 assert.equal((await db.query("select sc_private.report_photo_allowed('malformed/path') ok")).rows[0].ok,false);
 await db.exec('reset role;set role anon');await assert.rejects(report(301),/permission denied/);
 await db.exec('reset role');assert.deepEqual((await db.query('select to_jsonb(v) row from vistorias v order by client_uuid')).rows,baseline);
 await db.close();console.log('PASS: scoped reports, RS/SC and partner boundaries, no private fields, exact public photo manifest, denied guessing/write/delete, revocation and original data preserved');
})().catch(e=>{console.error(e);process.exit(1)});
