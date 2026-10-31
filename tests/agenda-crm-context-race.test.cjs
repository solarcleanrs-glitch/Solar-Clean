'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
function extract(name){const a=html.indexOf('async function '+name+'(');const match=/\n(?:async )?function |\n(?:let|const) [A-Za-z]/.exec(html.slice(a+1));return html.slice(a,match?a+1+match.index:html.length);}
(async()=>{
 let actor='A',saved=0,sends=0;const capture=()=>{const owner=actor;return ()=>{if(actor!==owner)throw Error('changed');};};
 let deps={captureVistoriaOperationGuard:capture,agendaLocal:()=>[{id:'local',unit:'RS',syncStatus:'pending'}],cloudReady:()=>true,navigator:{onLine:true},ensureVistoriaSession:async()=>{},cloudConfig:()=>({url:'https://zzphucuiqhzrilrddxnf.supabase.co'}),readStagingAgendaPages:async()=>{actor='B';return [];},canSeeAgendaUnit:()=>true,saveAgendaLocal:()=>saved++,console:{warn(){}},validateServiceContext:x=>x};
 let fn=new Function(...Object.keys(deps),'let agendaCache=[];'+extract('pullAgenda')+';return pullAgenda;')(...Object.values(deps));await assert.rejects(fn(),/changed/);assert.equal(saved,0);
 actor='A';deps={captureVistoriaOperationGuard:capture,crmLocalMeta:()=>({}),cloudReady:()=>true,navigator:{onLine:true},ensureVistoriaSession:async()=>{},crmHistoryCloudHeaders:()=>({}),cloudConfig:()=>({url:'test'}),fetch:async()=>({ok:true,json:async()=>{actor='B';return [{client_key:'x',updated_at:'2026'}];}}),saveCrmLocalMeta:()=>saved++,console:{warn(){}}};
 fn=new Function(...Object.keys(deps),'let crmMetaCache="unchanged";'+extract('pullCrmMeta')+';return {run:pullCrmMeta,cache:()=>crmMetaCache};')(...Object.values(deps));await assert.rejects(fn.run(),/changed/);assert.equal(saved,0);assert.equal(fn.cache(),'unchanged');
 actor='A';deps={captureVistoriaOperationGuard:capture,agendaLocal:()=>[{id:1,syncStatus:'pending'},{id:2,syncStatus:'pending'}],navigator:{onLine:true},cloudReady:()=>true,saveAgendaEvent:async()=>{sends++;actor='B';throw Error('network');}};
 fn=new Function(...Object.keys(deps),extract('syncPendingAgenda')+';return syncPendingAgenda;')(...Object.values(deps));await assert.rejects(fn(),/changed/);assert.equal(sends,1,'Stop loop instead of sending next A record as B');
 actor='A';let rendered=0;deps={captureVistoriaOperationGuard:capture,dbAll:async()=>{actor='B';return [];},$:()=>{rendered++;return {};},document:{querySelectorAll:()=>[]}};fn=new Function(...Object.keys(deps),extract('renderHistory')+';return renderHistory;')(...Object.values(deps));await assert.rejects(fn(),/changed/);assert.equal(rendered,0);
 console.log('PASS: respostas de agenda/CRM e histórico não gravam/renderizam após troca; fila para antes de enviar o próximo registro em outra conta');
})().catch(e=>{console.error(e);process.exitCode=1;});
