'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('function agendaArchiveConfirmed('),html.indexOf('function agendaLocal('));
const event={id:'legacy:42',cliente:'Cliente sintético',unit:'RS',baseRevision:3,syncStatus:'synced',note:'Preservar',googleEventId:'synthetic-google'};
const archived={id:event.id,revision:4,arquivado_em:'2026-11-04T18:00:00.000Z',updated_at:'2026-11-04T18:00:00.001Z'};
const copy=x=>JSON.parse(JSON.stringify(x));
function harness({rows=[event],responses=[],project='https://zzphucuiqhzrilrddxnf.supabase.co',online=true}={}){
 let local=copy(rows),changed=false,saves=0;const calls=[];
 const deps={cloudConfig:()=>({url:project}),cloudReady:()=>true,navigator:{onLine:online},
  captureVistoriaOperationGuard:()=>()=>{if(changed)throw Error('Conta mudou');},ensureVistoriaSession:async()=>{},
  agendaLocal:()=>copy(local),saveAgendaLocal:value=>{saves++;local=copy(value);},cloudHeaders:extra=>extra||{},Date,Number,Error,
  fetch:async(url,options={})=>{
   assert.ok(!url.includes('googleapis'));assert.ok([undefined,'PATCH'].includes(options.method));
   calls.push({url,...options});const result=responses.shift();
   if(result instanceof Error)throw result;
   if(typeof result==='function')return result({local,calls,change:()=>{changed=true;}});
   if(result===undefined)throw Error('Unexpected network request');
   return {ok:true,json:async()=>copy(result)};
  }};
 const run=new Function(...Object.keys(deps),source+';return archiveStagingAgenda;')(...Object.values(deps));
 return {run,calls,rows:()=>copy(local),saves:()=>saves};
}
(async()=>{
 let h=harness({responses:[[archived]]});await h.run({...event});
 assert.equal(h.rows()[0].archivedAt,archived.arquivado_em);assert.equal(h.rows()[0].note,'Preservar');assert.equal(h.rows()[0].googleEventId,'synthetic-google');
 assert.match(h.calls[0].url,/id=eq\.legacy%3A42&revision=eq\.3&arquivado_em=is.null/);
 assert.deepEqual(Object.keys(JSON.parse(h.calls[0].body)),['arquivado_em']);
 for(const uncertain of [new Error('Response lost'),[],()=>({ok:true,json:async()=>{throw Error('Body lost');}})]){
  h=harness({responses:[uncertain,[archived]]});await h.run({...event});
  assert.equal(h.calls.length,2);assert.equal(h.calls.filter(x=>x.method==='PATCH').length,1);
  assert.equal(h.calls[1].method,undefined,'recovery uses only a read');assert.equal(h.rows()[0].baseRevision,4);
  assert.match(h.calls[1].url,/select=id,revision,arquivado_em,updated_at&limit=1/);
 }
 for(const remote of [[],[{...archived,arquivado_em:null}],[{...archived,revision:3}],[{...archived,revision:4.5}],[{...archived,revision:'invalid'}],[{...archived,id:'other'}],[{...archived,arquivado_em:'invalid'}]]){
  h=harness({responses:[[],remote]});await assert.rejects(()=>h.run({...event}),/não confirmado|conflito/);
  assert.deepEqual(h.rows(),[event]);assert.equal(h.saves(),0);assert.equal(h.calls.filter(x=>x.method==='PATCH').length,1);
 }
 h=harness({responses:[()=>({ok:false,status:403})]});await assert.rejects(()=>h.run({...event}),/403/);assert.equal(h.calls.length,1);assert.equal(h.saves(),0);
 h=harness({responses:[new Error('Offline'),new Error('Still offline')]});await assert.rejects(()=>h.run({...event}),/sem confirmação/);assert.deepEqual(h.rows(),[event]);
 h=harness({responses:[[],()=>({ok:false,status:403})]});await assert.rejects(()=>h.run({...event}),/confirmar/);assert.equal(h.saves(),0);
 for(const local of [{...event,syncStatus:'pending',note:'New edit'},{...event,baseRevision:4}]){
  h=harness({rows:[local]});await assert.rejects(()=>h.run({...event}),/local mais recente/);assert.equal(h.calls.length,0);
 }
 h=harness({responses:[({local})=>{local[0].syncStatus='pending';local[0].note='New edit';return {ok:true,json:async()=>[archived]};}]});
 await assert.rejects(()=>h.run({...event}),/edição local/);assert.equal(h.rows()[0].note,'New edit');assert.equal(h.rows()[0].archivedAt,undefined);
 h=harness({responses:[({change})=>{change();return {ok:true,json:async()=>[archived]};}]});await assert.rejects(()=>h.run({...event}),/Conta mudou/);assert.equal(h.saves(),0);assert.equal(h.calls.length,1);
 const localArchived={...event,baseRevision:4,archivedAt:archived.arquivado_em};
 for(const clicked of [event,localArchived]){
  h=harness({rows:[localArchived],responses:[[archived]]});await h.run({...clicked});assert.equal(h.calls.length,1);assert.equal(h.calls[0].method,undefined);assert.equal(h.saves(),0);
 }
 h=harness({responses:[[archived],[],[archived]]});await Promise.all([h.run({...event}),h.run({...event})]);assert.equal(h.rows()[0].baseRevision,4);assert.equal(h.saves(),1);
 for(const options of [{project:'https://production.example.invalid'},{online:false}]){
  h=harness(options);await assert.rejects(()=>h.run({...event}));assert.equal(h.calls.length,0);
 }
 console.log('PASS: archive recovery is read-only after uncertain response, rejects denial/conflict/stale session, preserves edits and handles repeated/concurrent attempts');
})().catch(error=>{console.error(error);process.exitCode=1;});
