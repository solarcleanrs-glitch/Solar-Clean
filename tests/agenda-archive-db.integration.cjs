'use strict';
// Embedded PostgreSQL, synthetic rows only. Never connects to Supabase.
const assert=require('node:assert/strict'),fs=require('node:fs'),{PGlite}=require('@electric-sql/pglite');
(async()=>{
 const db=new PGlite(),manager='11111111-1111-4111-8111-111111111111',other='99999999-9999-4999-8999-999999999999',id='55555555-5555-4555-8555-555555555555';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
   create function public.sc_is_manager() returns boolean language sql stable as $$select auth.uid()='${manager}'::uuid$$;
   create table sc_parceiros(id uuid primary key default gen_random_uuid(),nome text unique not null,ativo boolean default true);
   create table sc_clientes_escopos(id uuid primary key,unidade text,parceiro_id uuid references sc_parceiros(id));`);
  await db.exec(fs.readFileSync('supabase/migrations/20261030_agenda_eventos_STAGING_NOT_APPLIED.sql','utf8'));
  await db.query(`insert into agenda_eventos(id,client_key,cliente,unidade,data,hora,observacao,valor_cobrado,google_event_id)
   values($1,'synthetic','Synthetic','RS','2026-11-04','10:00','Preserved note',350,'preserved-google-id')`,[id]);
  const before=(await db.query('select to_jsonb(e) as row from agenda_eventos e where id=$1',[id])).rows[0].row;
  const archive=()=>db.query(`update agenda_eventos set arquivado_em='2026-11-04T18:00:00Z'
   where id=$1 and revision=1 and arquivado_em is null returning id,revision,arquivado_em,updated_at`,[id]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);await db.exec('set role authenticated');
  assert.equal((await archive()).rows.length,0,'unauthorized role cannot archive');
  assert.equal((await db.query('select id from agenda_eventos where id=$1',[id])).rows.length,0);
  await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[manager]);await db.exec('set role authenticated');
  const first=(await archive()).rows;assert.equal(first.length,1);assert.equal(Number(first[0].revision),2);
  assert.equal((await archive()).rows.length,0,'retry must not mutate an archived event');
  const confirmed=(await db.query('select id,revision,arquivado_em,updated_at from agenda_eventos where id=$1 limit 1',[id])).rows;
  assert.deepEqual(confirmed,first,'read confirms the exact final archive state without another write');
  const after=(await db.query('select to_jsonb(e) as row from agenda_eventos e where id=$1',[id])).rows[0].row;
  for(const key of Object.keys(before))if(!['revision','arquivado_em','updated_at'].includes(key))assert.deepEqual(after[key],before[key],key+' preserved');
  await assert.rejects(db.query('delete from agenda_eventos where id=$1',[id]),/permission denied/);
  console.log('PASS: actual SQL/RLS denies other account, archives once by revision, confirms retry by read and preserves business fields/Google link');
 }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
