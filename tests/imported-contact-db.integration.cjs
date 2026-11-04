'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
(async()=>{
 const db=new PGlite(),id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema sc_private;
 grant usage on schema auth,sc_private to authenticated;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table crm_usuarios(user_id uuid primary key);alter table crm_usuarios enable row level security;
 grant select on crm_usuarios to authenticated;create policy own_member on crm_usuarios for select to authenticated using(user_id=auth.uid());
 create table sc_acessos(user_id uuid primary key,papel text,ativo boolean);
 create function sc_is_manager() returns boolean language sql stable security definer set search_path='' as
 $$select exists(select 1 from public.sc_acessos where user_id=auth.uid() and papel='gestor' and ativo)$$;
 revoke all on function sc_is_manager() from public;grant execute on function sc_is_manager() to authenticated;
 create table sc_clientes(id uuid primary key,cliente text);
 `);
 for(const [n,role] of [[1,'gestor'],[2,'tecnico'],[3,'gestor']]){
  await db.query('insert into crm_usuarios values($1)',[id(n)]);await db.query('insert into sc_acessos values($1,$2,true)',[id(n),role]);
 }
 await db.query("insert into sc_clientes values($1,'Synthetic'),($2,'Synthetic')",[id(101),id(102)]);
 const clients=(await db.query('select * from sc_clientes order by id')).rows;
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261103013039_imported_client_contact_history_staging.sql'),'utf8'));
 const asUser=async n=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[n?id(n):'']);await db.exec('set role authenticated');};
 const save=async(overrides={})=>{const p={id:id(201),client:id(101),outcome:'Cliente respondeu',note:'Synthetic internal note',followup:'2026-11-10',...overrides};return (await db.query('select sc_registrar_contato_cliente($1,$2,$3,$4,$5) r',[p.id,p.client,p.outcome,p.note,p.followup])).rows[0].r;};
 await asUser(1);assert.equal((await db.query('select sc_pode_registrar_contato_cliente() ok')).rows[0].ok,true);
 assert.equal((await save()).repetido,false);assert.equal((await save()).repetido,true);
 let history=(await db.query('select * from sc_historico_contatos_cliente($1)',[id(101)])).rows;assert.equal(history.length,1);
 const first=history[0];assert.equal(Object.hasOwn(first,'criado_por'),false);
 for(const change of [{note:'Changed'},{client:id(102)},{outcome:'Não deseja contato'},{followup:null}])await assert.rejects(save(change),/outros dados/);
 for(const invalid of [{id:null},{client:id(999)},{outcome:'unknown'},{note:'x'.repeat(2001)}])await assert.rejects(save({...invalid,id:invalid.id===null?null:id(202)}),/inválidos|encontrado/);
 assert.deepEqual((await db.query('select * from sc_historico_contatos_cliente($1)',[id(101)])).rows,[first]);
 for(const sql of ["insert into sc_private.cliente_contatos(id) values(gen_random_uuid())","update sc_private.cliente_contatos set observacao='changed'","delete from sc_private.cliente_contatos"])
  await assert.rejects(db.exec(sql),/permission denied/);
 await asUser(3);await assert.rejects(save(),/outros dados/,'another manager cannot reuse caller ID');
 for(const n of [2,99,null]){
  await asUser(n);assert.equal((await db.query('select sc_pode_registrar_contato_cliente() ok')).rows[0].ok,false);
  await assert.rejects(save({id:id(203)}),/restrito/);await assert.rejects(db.query('select * from sc_historico_contatos_cliente($1)',[id(101)]),/restrito/);
 }
 await db.exec('reset role');await db.query('update sc_acessos set ativo=false where user_id=$1',[id(1)]);await asUser(1);await assert.rejects(save(),/restrito/);
 await db.exec('reset role;set role anon');await assert.rejects(save(),/permission denied/);
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from sc_private.cliente_contatos')).rows[0].n,1);
 assert.deepEqual((await db.query('select * from sc_clientes order by id')).rows,clients);
 await db.close();console.log('PASS: manager-only immutable imported contact log, exact idempotent retry, conflicting IDs denied, private note access denied, revocation and client preservation');
})().catch(e=>{console.error(e);process.exit(1)});
