'use strict';
// Executes the existing local-only additive rehearsals followed by the new read
// projection against a synthetic legacy schema. Never connects to Supabase.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
(async () => {
  const db = new PGlite();
  const sql = name => fs.readFileSync(path.join(__dirname, '../supabase', name), 'utf8');
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    create table agenda_eventos(id text primary key,cliente text,telefone text,
      cidade text,endereco text,placas integer,unidade text,data date,hora time,
      duracao_min integer,tecnico text,status text,valor_cobrado numeric,
      valor_recebido numeric,observacao text);
    insert into agenda_eventos values('google:legacy/Event-1','Synthetic',null,
      null,null,12,'RS','2022-12-05','08:30',60,null,null,375,0,'private preserved');
    insert into agenda_eventos(id,cliente,unidade) values('legacy/no-date','Synthetic null date','SC');
  `);
  const before = (await db.query('select to_jsonb(e) as row from agenda_eventos e order by id')).rows;
  await db.exec(sql('rehearsals/20261101_agenda_legada_LOCAL_ONLY.sql'));
  await db.exec(sql('rehearsals/20261101_acesso_piloto_LOCAL_ONLY.sql'));
  // Membership is a separate prerequisite absent from some legacy deployments.
  // This synthetic-only table grants nothing and is NOT a production migration.
  await db.exec('create table crm_usuarios(user_id uuid primary key references auth.users(id))');
  await db.exec(sql('migrations/20261102220102_scoped_field_agenda_read_staging.sql'));
  assert.equal((await db.query('select count(*)::int n from sc_acessos')).rows[0].n, 0);
  const actor='11111111-1111-4111-8111-111111111111';
  await db.query('insert into auth.users values($1)', [actor]);
  await db.query('insert into crm_usuarios values($1)', [actor]);
  await db.query("insert into sc_acessos(user_id,papel,ativo) values($1,'gestor',true)", [actor]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor]);
  await db.exec('set role authenticated');
  const rows = (await db.query("select * from sc_agenda_campo('2022-12-01','2022-12-31','RS')")).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'google:legacy/Event-1', 'legacy text ID preserved');
  assert.equal(rows[0].maps_url, '', 'additive default readable');
  assert.equal(Object.hasOwn(rows[0], 'valor_cobrado'), false);
  assert.equal(Object.hasOwn(rows[0], 'observacao'), false);
  await db.exec('reset role');
  const after = (await db.query(`select to_jsonb(e)-array[
    'revision','maps_url','sc_escopo_id','arquivado_em'] as row
    from agenda_eventos e order by id`)).rows;
  assert.deepEqual(after, before, 'every legacy source field, null, ID and amount preserved');
  assert.equal((await db.query('select count(*)::int n from sc_clientes_escopos')).rows[0].n, 0,
    'no automatic client classification');
  await db.close();
  console.log('PASS: combined local legacy rehearsal preserves source data and text IDs; field projection works with explicit manager, no inferred scopes');
})().catch(e => { console.error(e); process.exit(1); });
