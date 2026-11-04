'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
(async()=>{
 const db=new PGlite();
 const original=fs.readFileSync(path.join(__dirname,'../supabase/rehearsals/20261101_conferir_agenda_legada_ROLLBACK_LOCAL.sql'),'utf8');
 await assert.rejects(db.exec(original),/banco local/);await db.exec('rollback');
 // Embedded DB has a fixed name; only replace that identity gate in the fixture.
 const sql=original.replace("current_database()<>'solar_clean_oficial_restore'",'false');
 await db.exec(`create table agenda_eventos(id text primary key,cliente text,valor_cobrado numeric,observacao text);
 create table vistorias(id bigint primary key,media_manifest jsonb);
 create table crm_clientes(client_key text primary key);
 insert into agenda_eventos values('Old:ID/1','Synthetic',123.45,null);
 insert into vistorias values(1,'{"before":"photo-data"}');`);
 const snapshot=(await db.query('select to_jsonb(a) as record from agenda_eventos a')).rows;
 let results=await db.exec(sql);
 assert.ok(results.some(r=>r.rows.some(x=>x.campos_novos_restantes===0)));
 assert.deepEqual((await db.query('select to_jsonb(a) as record from agenda_eventos a')).rows,snapshot);
 // Intentionally alter a legacy field inside the rehearsal: the comparator rejects it.
 const corrupt=sql.replace('create temporary table sc_ensaio_depois',"update public.agenda_eventos set observacao='changed'; create temporary table sc_ensaio_depois");
 await assert.rejects(db.exec(corrupt),/Diferença encontrada/);await db.exec('rollback');
 assert.deepEqual((await db.query('select to_jsonb(a) as record from agenda_eventos a')).rows,snapshot);
 await db.close();console.log('PASS: local-only rehearsal compares every original record, detects changes and rolls back all added columns');
})().catch(e=>{console.error(e);process.exit(1)});
