'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const handler=html.slice(html.indexOf('async function syncAgendaOnly(){'),html.indexOf("$('#syncAgendaOnly').onclick="));
const dashboard=html.slice(html.indexOf('async function updateDashboard(){'),html.indexOf('async function renderHistory(){'));
function harness(){
 const nodes=new Map(),calls=[];let staging=true,online=true,changed=false,queued=async()=>({synced:2,pending:0});
 const $=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',disabled:false,classList:{toggle(){}}});return nodes.get(id);};
 const ctx={$,captureVistoriaOperationGuard:()=>()=>{if(changed)throw Error('Conta mudou');},serviceContextEnabled:()=>staging,
  navigator:{get onLine(){return online;}},cloudReady:()=>true,ensureVistoriaSession:async()=>{calls.push('auth');},
  syncPendingAgenda:async()=>{calls.push('agenda');return queued();},updateDashboard:async()=>{calls.push('dashboard');},console:{warn(){}},Error,String};
 vm.createContext(ctx);vm.runInContext(handler,ctx);
 return {ctx,$,calls,setStage:v=>staging=v,setOnline:v=>online=v,change:()=>changed=true,queue:fn=>queued=fn};
}
(async()=>{
 let h=harness();await h.ctx.syncAgendaOnly();assert.deepEqual(h.calls,['auth','agenda','dashboard']);
 assert.match(h.$('#cloudStatus').textContent,/2 agendamento/);assert.equal(h.$('#syncAgendaOnly').disabled,false);
 h=harness();h.setStage(false);await h.ctx.syncAgendaOnly();assert.deepEqual(h.calls,['dashboard']);assert.match(h.$('#cloudStatus').textContent,/somente no projeto de testes/);
 h=harness();h.setOnline(false);await h.ctx.syncAgendaOnly();assert.equal(h.calls.includes('agenda'),false);assert.match(h.$('#cloudStatus').textContent,/internet/);
 h=harness();h.queue(async()=>{throw Error('Conflito preservado');});await h.ctx.syncAgendaOnly();assert.match(h.$('#cloudStatus').textContent,/Conflito preservado/);assert.equal(h.$('#syncAgendaOnly').disabled,false);
 h=harness();h.queue(async()=>{h.change();return {synced:1};});await h.ctx.syncAgendaOnly();assert.equal(h.$('#cloudStatus').textContent,'');assert.equal(h.calls.includes('dashboard'),false);
 // Dashboard reports both queues without touching their records.
 const nodes=new Map(),records=[{cliente:'A',syncStatus:'pending',cloudId:'a'},{cliente:'B',syncStatus:'synced',cloudId:'b'}],appointments=[{syncStatus:'pending'},{syncStatus:'synced'}];
 const $=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',classList:{toggle(){}}});return nodes.get(id);};
 let staging=true,badge='';
 const c={$,dbAll:async()=>records,agendaLocal:()=>appointments,captureVistoriaOperationGuard:()=>()=>{},serviceContextEnabled:()=>staging,cloudReady:()=>true,updateSyncBadge:text=>badge=text,Set};
 vm.createContext(c);vm.runInContext(dashboard,c);await c.updateDashboard();
 assert.equal($('#countPending').textContent,2);assert.match($('#pendingBreakdown').textContent,/1 vistoria.*1 agendamento/);assert.equal(badge,'2 pendente(s)');
 appointments[0].syncStatus='synced';await c.updateDashboard();assert.equal($('#countPending').textContent,1);
 records[0].syncStatus='synced';await c.updateDashboard();assert.equal($('#countPending').textContent,0);assert.equal(badge,'Sem envios pendentes');
 staging=false;appointments[0].syncStatus='pending';await c.updateDashboard();assert.equal($('#countPending').textContent,0);assert.equal($('#pendingBreakdown').textContent,'');
 console.log('PASS: agenda-only sync leaves inspections untouched, denies offline/non-staging, rejects changed sessions and reports both pending queues');
})().catch(error=>{console.error(error);process.exitCode=1;});
