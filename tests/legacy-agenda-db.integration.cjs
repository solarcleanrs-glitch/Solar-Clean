'use strict';
// Embedded PostgreSQL only; synthetic legacy records, no production connections.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
(async()=>{
const db=new PGlite();
const sql=fs.readFileSync(path.join(__dirname,'../supabase/rehearsals/20261101_agenda_legada_LOCAL_ONLY.sql'),'utf8');
await db.exec(`create table public.agenda_eventos (
 id text primary key, client_key text, cliente text, telefone text, cidade text,
 endereco text, placas integer, unidade text, data date, hora time,
 tecnico text,status text,observacao text,valor_servico numeric,gasto_extra numeric,
 gasto_extra_obs text,updated_at timestamptz,created_at timestamptz,duracao_min integer,
 google_event_id text,pagamento_status text,pagamento_forma text,
 valor_cobrado numeric,valor_recebido numeric);
create table public.vistorias(id bigint primary key, media_manifest jsonb);
insert into public.vistorias values(1,'{"antes":["preserved/photo.jpg"]}');
insert into public.agenda_eventos(id,cliente,unidade,status,valor_cobrado,created_at)
 values('google:old/event-1','Synthetic',null,'Legado',123.45,'2022-12-05T10:00:00Z'),
 ('not-a-uuid','Synthetic 2','Unidade antiga',null,null,null);`);
const before=(await db.query('select to_jsonb(a) as row from agenda_eventos a order by id')).rows;
const mediaBefore=(await db.query('select * from vistorias')).rows;
await db.exec(sql);
const after=(await db.query("select to_jsonb(a)-array['revision','maps_url','sc_escopo_id','arquivado_em'] as row from agenda_eventos a order by id")).rows;
assert.deepEqual(after,before,'all legacy fields, identifiers, nulls, timestamps and amounts preserved');
assert.deepEqual((await db.query('select * from vistorias')).rows,mediaBefore,'unrelated media untouched');
for(const r of (await db.query('select revision,maps_url,sc_escopo_id,arquivado_em from agenda_eventos')).rows)assert.deepEqual(r,{revision:1,maps_url:'',sc_escopo_id:null,arquivado_em:null});
await assert.rejects(db.exec(sql),/already exists/);await db.exec('rollback');
assert.deepEqual((await db.query('select id from agenda_eventos order by id')).rows,before.map(r=>({id:r.row.id})));
await db.close();
const incompatible=new PGlite();
await incompatible.exec('create table agenda_eventos(id uuid primary key)');
await assert.rejects(incompatible.exec(sql),/id text/);await incompatible.exec('rollback');
assert.equal((await incompatible.query("select count(*)::int as n from information_schema.columns where table_name='agenda_eventos'")).rows[0].n,1);
await incompatible.close();
console.log('PASS: additive legacy agenda rehearsal preserves text IDs, every original field and media; rejects replay and incompatible schema');
})().catch(e=>{console.error(e);process.exit(1)});
