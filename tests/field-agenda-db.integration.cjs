'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

(async () => {
  const db = new PGlite();
  const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    create table crm_usuarios(user_id uuid primary key);
    create table sc_parceiros(id uuid primary key, ativo boolean);
    create table sc_acessos(user_id uuid primary key, papel text, parceiro_id uuid, ativo boolean);
    create table sc_acesso_unidades(user_id uuid, unidade text);
    create table sc_clientes_escopos(id uuid primary key, unidade text, parceiro_id uuid);
    create table agenda_eventos(
      id text primary key, cliente text, telefone text, cidade text, endereco text,
      maps_url text, placas integer, unidade text, data date, hora time,
      duracao_min integer, tecnico text, status text, sc_escopo_id uuid,
      arquivado_em timestamptz, valor_recebido numeric, observacao text);
  `);
  for (let i = 1; i <= 8; i++) await db.query('insert into crm_usuarios values($1)', [uid(i)]);
  await db.query('insert into sc_parceiros values($1,true),($2,true)', [uid(101), uid(102)]);
  const roles = [[1,'gestor',null,true],[2,'tecnico',null,true],[3,'tecnico',null,true],
    [4,'parceiro',uid(101),true],[5,'parceiro',uid(102),true],
    [6,'tecnico',null,false],[7,'financeiro',null,true],[8,'tecnico',null,true]];
  for (const [i,role,partner,active] of roles)
    await db.query('insert into sc_acessos values($1,$2,$3,$4)', [uid(i), role, partner, active]);
  for (const [i,unit] of [[2,'RS'],[3,'SC'],[4,'RS'],[5,'SC'],[6,'RS'],[7,'RS']])
    await db.query('insert into sc_acesso_unidades values($1,$2)', [uid(i), unit]);
  await db.query('insert into sc_clientes_escopos values($1,\'RS\',$3),($2,\'SC\',$4)',
    [uid(201), uid(202), uid(101), uid(102)]);
  const fixtures = [
    ['Legacy:RS/1', 'RS', uid(201), null],
    ['SC:2', 'SC', uid(202), null],
    ['Unclassified', 'RS', null, null],
    ['Mismatched', 'SC', uid(201), null],
    ['Archived', 'RS', uid(201), '2026-10-01'],
  ];
  for (const [id,unit,scope,archived] of fixtures)
    await db.query(`insert into agenda_eventos(id,cliente,unidade,data,hora,sc_escopo_id,
      arquivado_em,valor_recebido,observacao) values($1,'Synthetic',$2,'2026-10-28','09:00',$3,$4,123,'PRIVATE')`,
    [id,unit,scope,archived]);
  const before = (await db.query('select * from agenda_eventos order by id')).rows;
  await db.exec(fs.readFileSync(path.join(__dirname,
    '../supabase/migrations/20261102220102_scoped_field_agenda_read_staging.sql'), 'utf8'));
  const asUser = async n => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [n ? uid(n) : '']);
    await db.exec('set role authenticated');
  };
  const read = async (unit=null) => (await db.query(
    "select * from sc_agenda_campo('2026-10-01','2026-10-31',$1)", [unit])).rows;
  await asUser(1);
  assert.equal((await read()).length, 4, 'manager sees both units and unclassified, not archived');
  assert.equal((await read('RS')).length, 2);
  const keys = Object.keys((await read())[0]).sort();
  assert.deepEqual(keys, ['id','cliente','telefone','cidade','endereco','maps_url','placas',
    'unidade','data','hora','duracao_min','tecnico','status'].sort(), 'explicit operational projection');
  for (const [n, expected] of [[2,['Legacy:RS/1']], [3,['SC:2']], [4,['Legacy:RS/1']], [5,['SC:2']], [8,[]]]) {
    await asUser(n); assert.deepEqual((await read()).map(x=>x.id), expected);
  }
  await asUser(2); assert.equal((await read('SC')).length, 0, 'unit parameter cannot expand access');
  await assert.rejects(db.exec('select valor_recebido from agenda_eventos'), /permission denied/);
  await assert.rejects(db.exec("update sc_acessos set papel='gestor'"), /permission denied/);
  await db.exec('reset role'); await db.query('update sc_acessos set ativo=false where user_id=$1',[uid(2)]);
  await asUser(2); await assert.rejects(read(), /não autorizado/, 'immediate revocation');
  for (const n of [6,7,99,null]) {
    await asUser(n); await assert.rejects(read(), /não autorizado|Autenticação necessária/);
  }
  await db.exec('reset role'); await db.query('update sc_parceiros set ativo=false where id=$1',[uid(101)]);
  await asUser(4); assert.equal((await read()).length,0,'inactive partner denied');
  await asUser(1);
  for (const sql of [
    "select * from sc_agenda_campo(null,'2026-10-31',null)",
    "select * from sc_agenda_campo('2026-10-31','2026-10-01',null)",
    "select * from sc_agenda_campo('2026-01-01','2026-10-31',null)",
    "select * from sc_agenda_campo('2026-10-01','2026-10-31','XX')"
  ]) await assert.rejects(db.exec(sql), /período/);
  await db.exec('reset role;set role anon');
  await assert.rejects(read(), /permission denied/);
  await assert.rejects(db.exec("select * from sc_private.agenda_campo('2026-10-01','2026-10-31',null)"), /permission denied/);
  await db.exec('reset role');
  assert.deepEqual((await db.query('select * from agenda_eventos order by id')).rows, before);
  assert.equal((await db.query(`select prosecdef from pg_proc where oid=
    'public.sc_agenda_campo(date,date,text)'::regprocedure`)).rows[0].prosecdef,false);
  await db.close();
  console.log('PASS: field projection, RS/SC, partner, unclassified/mismatched/archived, revocation, denied escalation/anon and unchanged source rows');
})().catch(e => { console.error(e); process.exit(1); });
