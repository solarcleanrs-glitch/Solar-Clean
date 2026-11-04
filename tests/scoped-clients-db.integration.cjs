'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
(async()=>{
 const db=new PGlite(),id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema sc_private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,sc_private to authenticated;
 create table crm_usuarios(user_id uuid primary key);
 create table sc_acessos(user_id uuid primary key,papel text,parceiro_id uuid,ativo boolean);
 create table sc_acesso_unidades(user_id uuid,unidade text);
 create table sc_parceiros(id uuid primary key,ativo boolean);
 create table sc_clientes(id uuid primary key,cliente text,telefone text,cidade text,endereco text,unidade text,origem text,parceiro_id uuid,cadastro_inicial jsonb);
 create table sc_cliente_origens_google(cliente_id uuid,evento_original jsonb);
 alter table sc_clientes enable row level security;grant select on sc_clientes to authenticated;
 create policy no_direct_read on sc_clientes for select to authenticated using(false);`);
 for(const [n,role,partner] of [[1,'gestor',null],[2,'tecnico',null],[3,'tecnico',null],[4,'parceiro',id(101)],[5,'parceiro',id(102)],[6,'financeiro',null]]){
  await db.query('insert into crm_usuarios values($1)',[id(n)]);await db.query('insert into sc_acessos values($1,$2,$3,true)',[id(n),role,partner]);
 }
 for(const [n,u] of [[2,'RS'],[3,'SC'],[4,'RS'],[5,'RS']])await db.query('insert into sc_acesso_unidades values($1,$2)',[id(n),u]);
 await db.query('insert into sc_parceiros values($1,true),($2,true)',[id(101),id(102)]);
 for(const [n,u,origin,partner] of [[201,'RS','particular',null],[202,'RS','parceiro',id(101)],[203,'RS','parceiro',id(102)],[204,'SC','particular',null],[205,'RS','nao_informada',null]])
  await db.query("insert into sc_clientes values($1,'Same name','same phone','Synthetic city','Synthetic street',$2,$3,$4,'{\"private\":true}')",[id(n),u,origin,partner]);
 await db.query("insert into sc_cliente_origens_google values($1,'{\"private_note\":true}')",[id(201)]);
 const before=(await db.query('select to_jsonb(c) r from sc_clientes c order by id')).rows;
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261103011052_scoped_imported_clients_read_staging.sql'),'utf8'));
 const asUser=async n=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[n?id(n):'']);await db.exec('set role authenticated');};
 const read=async(unit=null,search='')=>(await db.query('select * from sc_clientes_campo($1,$2)',[unit,search])).rows;
 await asUser(1);assert.equal((await read()).length,5);assert.equal((await read('SC')).length,1);assert.equal((await read(null,'absent')).length,0);
 for(const [n,expected] of [[2,[201,202,203]],[3,[204]],[4,[202]],[5,[203]]]){
  await asUser(n);const rows=await read();assert.deepEqual(rows.map(x=>x.id),expected.map(id),'same names/phones cannot expand scope or merge people');
  assert.deepEqual(Object.keys(rows[0]).sort(),['id','cliente','telefone','cidade','endereco','unidade','origem'].sort());
  assert.equal((await db.query('select count(*)::int n from sc_clientes')).rows[0].n,0,'RPC does not open direct table read');
 }
 await asUser(2);assert.equal((await read('SC')).length,0);
 await assert.rejects(read('XX'),/inválida/);await assert.rejects(read(null,'x'.repeat(101)),/inválida/);
 await asUser(6);await assert.rejects(read(),/não autorizado/);
 await asUser(99);await assert.rejects(read(),/não autorizado/);
 await asUser(null);await assert.rejects(read(),/Autenticação/);
 await db.exec('reset role');await db.query('update sc_parceiros set ativo=false where id=$1',[id(101)]);await asUser(4);assert.equal((await read()).length,0);
 await db.exec('reset role');await db.query('update sc_acessos set ativo=false where user_id=$1',[id(2)]);await asUser(2);await assert.rejects(read(),/não autorizado/);
 await db.exec('reset role;set role anon');await assert.rejects(read(),/permission denied/);await db.exec('reset role');
 assert.deepEqual((await db.query('select to_jsonb(c) r from sc_clientes c order by id')).rows,before);
 assert.equal((await db.query('select count(*)::int n from sc_cliente_origens_google')).rows[0].n,1);
 await db.close();console.log('PASS: imported CRM scope, partners, unclassified/unknown/finance denial, safe projection, same-name separation, revocation and preserved clients/origins');
})().catch(e=>{console.error(e);process.exit(1)});
