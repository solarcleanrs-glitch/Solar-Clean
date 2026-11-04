'use strict';
// Offline PostgreSQL rehearsal. Synthetic identities only; no hosted credentials.
const assert=require('node:assert/strict'),fs=require('node:fs'),{PGlite}=require('@electric-sql/pglite');
(async()=>{
 const db=new PGlite(),id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const load=async name=>{try{await db.exec(fs.readFileSync('supabase/migrations/'+name+'.sql','utf8'));}catch(e){throw new Error(name+': '+e.message,{cause:e});}};
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage to authenticated;
 create table storage.objects(id text primary key,bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant select,insert,update,delete on storage.objects to authenticated;
 create policy old_team on storage.objects for all to authenticated using(true) with check(true);`);
 for(const name of ['20261028_crm_contatos_staging','20261028_crm_metadados_staging','20261028_crm_perfis_staging','20261028_vistorias_auth_staging','20261030_access_foundation_STAGING_NOT_APPLIED'])await load(name);
 for(let n=1;n<=3;n++){
 await db.query('insert into auth.users values($1,$2)',[id(n),`synthetic-${n}@example.invalid`]);
 await db.query('insert into crm_usuarios values($1)',[id(n)]);}
 await db.query("select set_config('sc_bootstrap.manager_uuid',$1,false),set_config('sc_bootstrap.manager_email',$2,false)",[id(1),'synthetic-1@example.invalid']);
 for(const name of ['20261030_manager_gate_STAGING_NOT_APPLIED','20261030_agenda_eventos_STAGING_NOT_APPLIED','20261030_fechamentos_STAGING_NOT_APPLIED','20261031_clientes_historico_STAGING_NOT_APPLIED','20261102220102_scoped_field_agenda_read_staging','20261102225941_restrict_legacy_report_media_paths_staging','20261103003507_scoped_report_read_staging','20261103004245_scoped_report_list_staging','20261103011052_scoped_imported_clients_read_staging','20261103013039_imported_client_contact_history_staging','20261104014308_imported_client_edit_staging','20261104192519_field_agenda_status_staging','20261104222525_unit_manager_permissions_staging'])await load(name);
 await db.query("insert into sc_acessos(user_id,papel,ativo) values($1,'gestor_unidade',true),($2,'tecnico',true)",[id(2),id(3)]);
 await db.query("insert into sc_acesso_unidades values($1,'RS'),($2,'RS')",[id(2),id(3)]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(1)]);
 for(const [n,unit]of [[10,'RS'],[11,'SC']]){
 await db.query('insert into sc_clientes_escopos(id,unidade,legacy_client_key) values($1,$2,$3)',[id(n),unit,'synthetic-'+unit]);
 await db.query("insert into agenda_eventos(id,client_key,cliente,unidade,sc_escopo_id,data,hora,status) values($1,$2,'Synthetic',$3,$4,'2026-11-04','10:00','Agendado')",[id(n+10),'synthetic-'+unit,unit,id(n)]);
 await db.query("insert into vistorias(client_uuid,cliente,sc_escopo_id) values($1,'Synthetic',$2)",[id(n+20),id(n)]);
 await db.query("insert into storage.objects values($1,'vistoria-media',$2)",['photo-'+unit,id(n+20)+'/private.jpg']);}
 const as=async n=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(n)]);await db.exec('set role authenticated');};
 const rows=async table=>(await db.query('select * from '+table)).rows;
 await db.query("insert into sc_parceiros(id,nome) values($1,'Synthetic partner')",[id(60)]);
 await db.query('update sc_clientes_escopos set parceiro_id=$1',[id(60)]);
 await db.query("update agenda_eventos set status='Concluído',valor_cobrado=100,valor_recebido=0");
 await db.query("insert into storage.objects values('orphan','vistoria-media',$1)",[id(90)+'/unknown.jpg']);
 const close=(n,unit,event)=>db.query("select sc_criar_fechamento($1,$2,$3,'2026-11-01',$4)",[id(n),id(60),unit,[{id:id(event),revision:2}]]);
 await as(1);await close(70,'SC',21);
 await db.query('select sc_importar_cliente_google($1,$2,$3,$4,$5,true)',[id(51),'synthetic-calendar','event-sc',{cliente:'Synthetic SC',telefone:'',cidade:'City',endereco:'Street',unidade:'SC',origem:'particular',parceiro_id:null},{id:'event-sc',status:'confirmed'}]);
 await as(1);assert.equal((await rows('agenda_eventos')).length,2);assert.equal((await rows('vistorias')).length,2);
 await as(2);assert.equal((await db.query('select sc_is_manager() ok')).rows[0].ok,false);
 assert.equal((await rows('agenda_eventos')).length,1);assert.equal((await rows('vistorias')).length,1);
 assert.deepEqual((await rows('storage.objects')).map(x=>x.id),['photo-RS']);
 await close(71,'RS',20);
 await db.query("select sc_registrar_recebimento($1,$2,100,'2026-11-04','Pix')",[id(72),id(71)]);
 await assert.rejects(close(73,'SC',21),/gestor/);
 await assert.rejects(db.query("select sc_registrar_recebimento($1,$2,100,'2026-11-04','Pix')",[id(74),id(70)]),/gestor/);
 await assert.rejects(db.query("select sc_cancelar_fechamento($1,'Synthetic cancel')",[id(70)]),/gestor/);
 for(const table of ['sc_fechamentos','sc_fechamento_itens','sc_fechamento_recebimentos'])assert.equal((await rows(table)).length,1);
 assert.equal((await db.query("select * from sc_agenda_campo('2026-11-04','2026-11-04',null)")).rows.length,1);
 assert.equal((await db.query('select sc_relatorio_campo($1) r',[id(31)])).rows[0].r,null);
 await assert.rejects(db.query('select sc_cliente_edicao($1)',[id(51)]),/restrita/);
 await assert.rejects(db.query('select sc_importar_cliente_google($1,$2,$3,$4,$5,true)',[id(51),'synthetic-calendar','event-sc',{cliente:'Spoof',unidade:'RS'},{id:'event-sc'}]),/restrit|autorizad/i);
 await assert.rejects(db.query("update agenda_eventos set unidade='SC' where id=$1",[id(20)]),/row-level security|classificação estão bloqueados/);
 await assert.rejects(db.query("insert into sc_acesso_unidades values($1,'SC')",[id(2)]),/row-level security/);
 assert.equal((await db.query("update sc_acessos set papel='gestor' where user_id=$1 returning user_id",[id(2)])).rows.length,0);
 await assert.rejects(db.query('select sc_reservar_midia_gerencia($1,$2)',[id(31),id(10)]),/outro escopo/);
 await assert.rejects(db.query('select sc_reservar_midia_gerencia($1,$2)',[id(90),id(10)]),/sem escopo/);
 await assert.rejects(db.query('insert into vistorias(client_uuid,sc_escopo_id) values($1,$2)',[id(90),id(10)]),/Reserva/);
 await db.query('select sc_reservar_midia_gerencia($1,$2)',[id(40),id(10)]);
 await db.query("insert into storage.objects values('new','vistoria-media',$1)",[id(40)+'/new.jpg']);
 await db.query('insert into vistorias(client_uuid,sc_escopo_id) values($1,$2)',[id(40),id(10)]);
 await assert.rejects(db.query("insert into storage.objects values('attack','vistoria-media',$1)",[id(31)+'/new.jpg']),/row-level security/);
 await assert.rejects(db.query('select sc_agenda_status_campo($1)',[id(21)]),/indisponível/);
 assert.equal((await db.query('select sc_agenda_status_campo($1) r',[id(20)])).rows[0].r.status,'Concluído');
 const cadastro=unit=>({cliente:'Synthetic',telefone:'',cidade:'City',endereco:'Street',unidade:unit,origem:'particular',parceiro_id:null});
 await db.query('select sc_importar_cliente_google($1,$2,$3,$4,$5,true)',[id(50),'synthetic-calendar','event-rs',cadastro('RS'),{id:'event-rs',status:'confirmed'}]);
 await assert.rejects(db.query('select sc_importar_cliente_google($1,$2,$3,$4,$5,true)',[id(51),'synthetic-calendar','event-sc',cadastro('SC'),{id:'event-sc',status:'confirmed'}]),/restrit|autorizad/i);
 assert.equal((await db.query('select sc_cliente_edicao($1) r',[id(50)])).rows[0].r.cliente,'Synthetic');
 await as(3);assert.equal((await rows('agenda_eventos')).length,0);assert.equal((await rows('vistorias')).length,0);
 assert.equal((await rows('sc_clientes')).length,0);assert.equal((await rows('storage.objects')).length,0);
 assert.equal((await db.query('select sc_agenda_status_campo($1) r',[id(20)])).rows[0].r.status,'Concluído');
 await assert.rejects(db.query('select sc_agenda_status_campo($1)',[id(21)]),/indisponível/);
 await assert.rejects(db.query('select sc_reservar_midia_gerencia($1,$2)',[id(41),id(10)]),/autorizado/);
 await db.exec('reset role');await db.query('update sc_acessos set ativo=false where user_id=$1',[id(2)]);await as(2);
 assert.equal((await rows('agenda_eventos')).length,0);assert.equal((await rows('vistorias')).length,0);assert.equal((await rows('storage.objects')).length,0);
 console.log('PASS: composed migrations, global/scoped/technical separation, RS/SC RLS, self-escalation denied, scoped media/import/status and immediate revocation');
 }finally{await db.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
