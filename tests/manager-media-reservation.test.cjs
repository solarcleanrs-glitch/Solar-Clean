'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8'),source=html.slice(html.indexOf('const pendingRecordUploads=new Map();'),html.indexOf('async function pullCloud()'));
const visit='11111111-1111-4111-8111-111111111111',scope='22222222-2222-4222-8222-222222222222';
function harness(response,denied=false){
 const calls=[];const deps={window:{SCOperationalAccessUI:{require:async(cap,unit)=>{calls.push(['access',cap,unit]);if(denied)throw Error('Synthetic denied');return {role:'gestor_unidade'};}}},ensureVistoriaSession:async()=>{},cloudConfig:()=>({url:'https://zzphucuiqhzrilrddxnf.supabase.co'}),cloudScopePayload:()=>{},ensureRecordScope:async()=>calls.push(['scope']),revisionProtocolEnabled:()=>true,cloudHeaders:()=>({}),fetch:async(url,o)=>{calls.push(['rpc',url,JSON.parse(o.body)]);if(response instanceof Error)throw response;return response;},uploadPhotoToStorage:async()=>{calls.push(['photo']);throw Error('Synthetic stop after reserved photo');}};
 return {calls,push:new Function(...Object.keys(deps),source+'\nreturn pushRecord;')(...Object.values(deps))};
}
(async()=>{
 const record=()=>({id:1,cloudId:visit,scopeId:scope,serviceContext:{unit:'RS'},photos:[{}],baseRevision:0,syncStatus:'pending'});
 for(const result of [{ok:false},{ok:true,json:async()=>false},new Error('Synthetic network loss')]){
  const h=harness(result);await assert.rejects(h.push(record()),/Reserva|network/);assert.equal(h.calls.some(c=>c[0]==='photo'),false);
 }
 const h=harness({ok:true,json:async()=>true});await assert.rejects(h.push(record()),/stop after reserved/);
 assert.deepEqual(h.calls.map(c=>c[0]),['access','scope','rpc','photo']);
 assert.deepEqual(h.calls[2][2],{p_vistoria:visit,p_escopo:scope});assert.match(h.calls[2][1],/sc_reservar_midia_gerencia$/);
 const denied=harness(null,true);await assert.rejects(denied.push(record()),/denied/);assert.deepEqual(denied.calls.map(c=>c[0]),['access']);
 const unclassified=harness(null);await assert.rejects(unclassified.push({...record(),scopeId:null}),/Classifique/);assert.equal(unclassified.calls.some(c=>c[0]==='rpc'),false);
 console.log('PASS: actual upload requires server write capability and confirmed scope reservation before the first photo; denied/lost response preserves pending data');
})().catch(e=>{console.error(e);process.exitCode=1;});
