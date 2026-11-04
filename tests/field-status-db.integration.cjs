'use strict';
// Actual embedded PostgreSQL, synthetic identities/data only; no hosted connection.
const assert=require('node:assert/strict'),fs=require('node:fs'),{randomUUID}=require('node:crypto'),{PGlite}=require('@electric-sql/pglite');
(async()=>{
 const db=new PGlite(),textIds=process.env.SC_TEST_TEXT_AGENDA_IDS==='1';
 const actor=n=>`${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
 const manager=actor(1),rs=actor(2),sc=actor(3),partner=actor(4),finance=actor(5),inactive=actor(6),nomember=actor(7),unknown=actor(8);
 const scopeRS='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',scopeSC='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
 const id=n=>textIds?`google:legacy/event-${n}`:`bbbbbbbb-bbbb-4bbb-8bbb-${String(n).padStart(12,'0')}`;
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
   create table crm_usuarios(user_id uuid primary key references auth.users(id));
   create table sc_acessos(user_id uuid primary key references auth.users(id),papel text,parceiro_id uuid,ativo boolean);
   create table sc_acesso_unidades(user_id uuid references auth.users(id),unidade text);
   create table sc_parceiros(id uuid primary key default gen_random_uuid(),nome text unique,ativo boolean);
   create table sc_clientes_escopos(id uuid primary key,unidade text,parceiro_id uuid);
   create function sc_is_manager() returns boolean language sql stable security definer set search_path='' as
   $$select exists(select 1 from public.sc_acessos where user_id=auth.uid() and papel='gestor' and ativo)$$;`);
  let agenda=fs.readFileSync('supabase/migrations/20261030_agenda_eventos_STAGING_NOT_APPLIED.sql','utf8');
  if(textIds)agenda=agenda.replace('id uuid primary key default gen_random_uuid(),','id text primary key,');
  await db.exec(agenda);
  await db.exec(fs.readFileSync('supabase/migrations/20261102220102_scoped_field_agenda_read_staging.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261104192519_field_agenda_status_staging.sql','utf8'));
  for(const u of [manager,rs,sc,partner,finance,inactive,nomember,unknown])await db.query('insert into auth.users values($1)',[u]);
  for(const u of [manager,rs,sc,partner,finance,inactive,unknown])await db.query('insert into crm_usuarios values($1)',[u]);
  for(const [u,role,active]of [[manager,'gestor',true],[rs,'tecnico',true],[sc,'tecnico',true],[partner,'parceiro',true],[finance,'financeiro',true],[inactive,'tecnico',false],[nomember,'tecnico',true]])await db.query('insert into sc_acessos(user_id,papel,ativo) values($1,$2,$3)',[u,role,active]);
  for(const [u,unit]of [[rs,'RS'],[sc,'SC'],[partner,'RS'],[inactive,'RS'],[nomember,'RS']])await db.query('insert into sc_acesso_unidades values($1,$2)',[u,unit]);
  await db.query("insert into sc_clientes_escopos values($1,'RS',null),($2,'SC',null)",[scopeRS,scopeSC]);
  for(const [n,unit,scope,status]of [[1,'RS',scopeRS,'Agendado'],[2,'SC',scopeSC,'Agendado'],[3,'RS',null,'Agendado'],[4,'RS',scopeRS,'Agendado'],[5,'RS',scopeRS,'Cancelado']]){
   await db.query(`insert into agenda_eventos(id,client_key,cliente,unidade,sc_escopo_id,data,hora,status,observacao,valor_cobrado,gasto_extra,google_event_id)
    values($1,'synthetic','Synthetic',$2,$3,'2026-11-04','10:00',$4,'PRIVATE',350,17,'preserved-google')`,[id(n),unit,scope,status]);
  }
  await db.query('update agenda_eventos set arquivado_em=now() where id=$1',[id(4)]);
  const before=(await db.query('select id,to_jsonb(e) as row from agenda_eventos e order by id')).rows;
  const as=async u=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[u||'']);await db.exec('set role authenticated');};
  const snapshot=n=>db.query('select sc_agenda_status_campo($1) as result',[id(n)]).then(r=>r.rows[0].result);
  const capable=()=>db.query('select sc_pode_avancar_status_campo() as result').then(r=>r.rows[0].result);
  const move=(key,n,rev,status)=>db.query('select sc_avancar_status_campo($1,$2,$3,$4) as result',[key,id(n),rev,status]).then(r=>r.rows[0].result);
  await as(rs);assert.equal(await capable(),true);
  const s=await snapshot(1);assert.deepEqual(Object.keys(s).sort(),['id','proximo_status','revision','status']);assert.equal(s.proximo_status,'Em deslocamento');
  assert.equal((await db.query('select id from agenda_eventos')).rows.length,0,'legacy table remains inaccessible to technician');
  assert.equal((await db.query("update agenda_eventos set valor_cobrado=1 where id=$1 returning id",[id(1)])).rows.length,0);
  const firstID=randomUUID(),first=await move(firstID,1,1,'Em deslocamento');assert.equal(first.repetido,false);assert.equal(first.revision,2);assert.equal(first.estado_atual.status,'Em deslocamento');
  assert.equal((await move(firstID,1,1,'Em deslocamento')).repetido,true);
  await assert.rejects(move(firstID,1,2,'Em atendimento'),/outro conteúdo/);
  await assert.rejects(move(randomUUID(),1,1,'Em deslocamento'),/alterado/);
  await move(randomUUID(),1,2,'Em atendimento');await move(randomUUID(),1,3,'Concluído');
  const repeated=await move(firstID,1,1,'Em deslocamento');assert.equal(repeated.revision,2);assert.equal(repeated.estado_atual.revision,4);assert.equal(repeated.estado_atual.status,'Concluído');
  await assert.rejects(move(randomUUID(),1,4,'Em deslocamento'),/não permitido/);
  await assert.rejects(snapshot(2),/indisponível/);await assert.rejects(move(randomUUID(),2,1,'Em deslocamento'),/indisponível/);
  await assert.rejects(snapshot(3),/indisponível/);await assert.rejects(snapshot(4),/indisponível/);
  await assert.rejects(move(randomUUID(),5,1,'Em deslocamento'),/não permitido/);
  await assert.rejects(db.query('select * from sc_private.agenda_status_eventos'),/permission denied/);
  await assert.rejects(db.query('select sc_private.agenda_status_autorizada($1)',[id(1)]),/permission denied/);
  await as(sc);await assert.rejects(move(randomUUID(),2,1,'Concluído'),/não permitido/);assert.equal((await snapshot(2)).revision,1);
  await move(randomUUID(),2,1,'Em deslocamento');
  for(const u of [partner,finance,inactive,nomember,unknown,null]){
   await as(u);assert.equal(await capable(),false);await assert.rejects(snapshot(1),/indisponível/);await assert.rejects(move(randomUUID(),1,4,'Em deslocamento'),/indisponível/);
  }
  await db.exec('reset role');await db.query("delete from sc_acesso_unidades where user_id=$1",[rs]);await as(rs);await assert.rejects(move(firstID,1,1,'Em deslocamento'),/indisponível/);
  await db.exec('reset role');await db.query("insert into sc_acesso_unidades values($1,'RS')",[rs]);await db.query('update sc_acessos set ativo=false where user_id=$1',[rs]);await as(rs);assert.equal(await capable(),false);await assert.rejects(snapshot(1),/indisponível/);
  await as(manager);await assert.rejects(move(firstID,1,1,'Em deslocamento'),/outro conteúdo/);
  for(const [key,rev,status]of [[null,1,'Em deslocamento'],[randomUUID(),0,'Em deslocamento'],[randomUUID(),1,null],[randomUUID(),1,'Cancelado']])await assert.rejects(move(key,3,rev,status),/inválida/);
  await move(randomUUID(),3,1,'Em deslocamento');
  await db.exec('reset role');
  assert.equal((await db.query('select count(*)::int n from sc_private.agenda_status_eventos')).rows[0].n,5);
  const after=(await db.query('select id,to_jsonb(e) as row from agenda_eventos e order by id')).rows;
  for(let i=0;i<before.length;i++)for(const k of Object.keys(before[i].row))if(!['status','revision','updated_at'].includes(k))assert.deepEqual(after[i].row[k],before[i].row[k],k+' preserved');
  await db.exec('set role anon');await assert.rejects(db.query('select sc_pode_avancar_status_campo()'),/permission denied/);
  console.log('PASS: field status SQL/RLS, RS/SC, partner/finance denied, revoked account/unit, one-step CAS, same-intent retry and private data preserved; '+(textIds?'text IDs':'UUID IDs'));
 }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
