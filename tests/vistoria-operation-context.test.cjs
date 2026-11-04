'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const pull=html.slice(html.indexOf('async function pullCloud(){'),html.indexOf(' let syncAllRunning=false;'));
const push=html.slice(html.indexOf('const pendingRecordUploads=new Map();'),html.indexOf('async function inspectPendingStagingLink'));
const helper=html.slice(html.indexOf('function captureVistoriaOperationGuard(){'),html.indexOf('function endCloudSession(){'));
(async()=>{
 let identity='A',writes=[],headers=[];
 const base={cloudConfig:()=>({url:'https://zzphucuiqhzrilrddxnf.supabase.co'}),ensureVistoriaSession:async()=>{},captureVistoriaOperationGuard:()=>{const a=identity;return ()=>{if(identity!==a)throw Error('Conta mudou');};},cloudHeaders:()=>{headers.push(identity);return {};},dbAll:async()=>[],dbAdd:async r=>writes.push(r),dbPut:async r=>writes.push(r),fromCloud:x=>x,fetch:async()=>({ok:true,json:async()=>{identity='B';return [{cloudId:'a'}];}})};
 let run=new Function(...Object.keys(base),pull+';return pullCloud;')(...Object.values(base));await assert.rejects(run(),/Conta mudou/);assert.equal(writes.length,0);assert.deepEqual(headers,['A']);
 identity='A';base.fetch=async()=>({ok:true,json:async()=>[{cloudId:'a'}]});base.dbAll=async()=>{identity='B';return [];};run=new Function(...Object.keys(base),pull+';return pullCloud;')(...Object.values(base));await assert.rejects(run(),/Conta mudou/);assert.equal(writes.length,0);
 identity='A';let sent=0;const deps={...base,revisionProtocolEnabled:()=>true,toCloud:r=>({client_uuid:r.cloudId}),uploadPhotoToStorage:async p=>p,crypto:{randomUUID:()=> 'stable'},fetch:async()=>{sent++;return {ok:true,json:async()=>{identity='B';return [{client_uuid:'stable',revision:1}];}};}};
 run=new Function(...Object.keys(deps),push+';return pushRecord;')(...Object.values(deps));await assert.rejects(run({id:1,cloudId:'stable',baseRevision:0,syncStatus:'pending',photos:[]}),/Conta mudou/);assert.equal(sent,1);assert.equal(writes.length,0,'Do not mark response from old session synced');
 // The actual guard accepts token rotation for the same actor, rejects logout/project changes.
 let token='A',tech='same';const config={url:'https://zzphucuiqhzrilrddxnf.supabase.co',key:'public'};const ctx={authSessionGeneration:0,cloudConfig:()=>config,localStorage:{getItem:k=>k==='solarCleanTech'?tech:'x.'+token+'.x'},atob:t=>JSON.stringify({sub:t==='A2'?'A':t}),Error};vm.createContext(ctx);vm.runInContext(helper,ctx);const guard=ctx.captureVistoriaOperationGuard();token='A2';guard();token='B';assert.throws(guard,/conta mudou/);token='A';ctx.authSessionGeneration++;assert.throws(guard,/conta mudou/);
 console.log('PASS: resposta/consulta atrasada bloqueia gravação local e confirmação de sincronização após troca de conta; token renovado do mesmo usuário é aceito');
})().catch(e=>{console.error(e);process.exitCode=1;});
