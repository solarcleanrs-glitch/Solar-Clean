'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
(async()=>{
const db=new PGlite(),id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
await db.exec("create role anon;create role authenticated;create schema auth;create schema sc_private;"+
"create table auth.users(id uuid primary key);"+
"create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;"+
"grant usage on schema auth,sc_private to authenticated;"+
"create table crm_usuarios(user_id uuid primary key);"+
"create table sc_acessos(user_id uuid,papel text,ativo boolean);"+
"create table sc_parceiros(id uuid primary key,ativo boolean);"+
"create function sc_is_manager() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.sc_acessos where user_id=auth.uid() and papel='gestor' and ativo)$$;");
for(const [n,papel] of [[1,'gestor'],[2,'tecnico'],[3,'parceiro'],[4,'financeiro'],[5,'gestor']]){
await db.query('insert into auth.users values($1)',[id(n)]);
await db.query('insert into crm_usuarios values($1)',[id(n)]);
await db.query('insert into sc_acessos values($1,$2,true)',[id(n),papel]);}
await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261031_clientes_historico_STAGING_NOT_APPLIED.sql'),'utf8'));
await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/proposals/imported-client-edit.sql'),'utf8'));
const asUser=async n=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[n?id(n):'']);await db.exec('set role authenticated');};
const original={cliente:'Synthetic',telefone:'',cidade:'City',endereco:'Street',unidade:'RS',origem:'particular',parceiro_id:null},event={id:'event',status:'confirmed'};
await asUser(1);
const importClient=()=>db.query('select sc_importar_cliente_google($1,$2,$3,$4,$5,true) r',[id(100),'synthetic-calendar','event',original,event]);
await importClient();
const read=()=>db.query('select sc_cliente_edicao($1) r',[id(100)]);
const dados={cliente:'Corrected',telefone:'+5551999999999',cidade:'New city',endereco:'New street',status_comercial:'Não contatar'};
const edit=(operation=200,revision=1,data=dados)=>db.query('select sc_editar_cliente($1,$2,$3,$4) r',[id(operation),id(100),revision,data]);
assert.equal((await read()).rows[0].r.revision,1);
assert.equal((await edit()).rows[0].r.repetido,false);
assert.equal((await edit()).rows[0].r.repetido,true);
await assert.rejects(edit(201),/Cadastro alterado/);
await assert.rejects(edit(200,1,{...dados,cliente:'Different'}),/outros dados/);
for(const data of [{...dados,unidade:'SC'},{...dados,status_comercial:'unknown'},{...dados,telefone:'bad'},{...dados,cliente:null},{...dados,cliente:''}]){
await assert.rejects(edit(202,2,data),/inválidos/);}
assert.equal((await importClient()).rows[0].r.repetido,true,'original import retry survives later correction');
assert.equal((await read()).rows[0].r.cliente,'Corrected','retry cannot reset corrected name');
for(const n of [2,3,4,99,null]){await asUser(n);await assert.rejects(read(),/restrita/);await assert.rejects(edit(203,2),/restrita/);}
await asUser(5);await assert.rejects(edit(),/outros dados/);
await db.exec('reset role');await db.query('update sc_acessos set ativo=false where user_id=$1',[id(1)]);await asUser(1);await assert.rejects(edit(204,2),/restrita/);
await db.exec('reset role;set role anon');await assert.rejects(read(),/permission denied/);
await db.exec('reset role;set role authenticated');await assert.rejects(db.query('select * from sc_private.cliente_edicoes'),/permission denied/);
await assert.rejects(db.query("update sc_clientes set cliente='Bypass'"),/permission denied/);
await db.exec('reset role');
const saved=(await db.query('select * from sc_clientes')).rows[0];
assert.deepEqual(saved.cadastro_inicial,original);assert.equal(saved.unidade,'RS');assert.equal(saved.origem,'particular');assert.equal(saved.revision,2);
assert.equal((await db.query('select count(*)::int n from sc_cliente_origens_google')).rows[0].n,1);
const audit=(await db.query('select * from sc_private.cliente_edicoes')).rows;
assert.equal(audit.length,1);assert.equal(audit[0].antes.cliente,'Synthetic');assert.equal(audit[0].depois.cliente,'Corrected');
assert.equal(Object.hasOwn(audit[0].depois,'cadastro_inicial'),false);
await db.close();console.log('PASS: isolated edit, revision conflict, exact retry, immutable import, role/revocation denial and private audit');
})().catch(e=>{console.error(e);process.exit(1)});
