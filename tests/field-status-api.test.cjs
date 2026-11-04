'use strict';
const assert=require('node:assert/strict'),api=require('../lib/field-agenda-api.js');
const id='google:legacy/event-1',attempt='11111111-1111-4111-8111-111111111111',project='https://zzphucuiqhzrilrddxnf.supabase.co';
const snapshot={id,revision:1,status:'Agendado',proximo_status:'Em deslocamento',valor_cobrado:'PRIVATE'};
let changed=false,response=snapshot;const calls=[];
const ctx={url:project,headers:{Authorization:'Bearer synthetic'},check:()=>{if(changed)throw Error('changed');},fetch:async(url,options)=>{calls.push({url,...options});if(response instanceof Error)throw response;return {ok:true,json:async()=>response};}};
(async()=>{
 const clean=await api.agendaStatus(ctx,id);assert.deepEqual(Object.keys(clean).sort(),['id','proximo_status','revision','status']);assert.equal(clean.valor_cobrado,undefined);
 assert.match(calls[0].url,/rpc\/sc_agenda_status_campo$/);assert.deepEqual(JSON.parse(calls[0].body),{p_agendamento:id});
 response=true;assert.equal(await api.canAdvanceStatus(ctx),true);response=false;assert.equal(await api.canAdvanceStatus(ctx),false);
 response='true';await assert.rejects(api.canAdvanceStatus(ctx),/inválida/);
 for(const data of [{...snapshot,id:'other'},{...snapshot,revision:0},{...snapshot,revision:1.5},{...snapshot,proximo_status:'Concluído'}]){response=data;await assert.rejects(api.agendaStatus(ctx,id),/inválida/);}
 const intent=api.statusIntent(id,1,'Em deslocamento',attempt);assert.equal(Object.isFrozen(intent),true);
 response=new Error('network lost');await assert.rejects(api.advanceStatus(ctx,intent),/network lost/);const firstBody=calls.at(-1).body;
 response={id:attempt,agendamento_id:id,revision:2,status:'Em deslocamento',repetido:true,estado_atual:{id,revision:3,status:'Em atendimento',proximo_status:'Concluído',observacao:'PRIVATE'},financeiro:'PRIVATE'};
 const result=await api.advanceStatus(ctx,intent);assert.equal(calls.at(-1).body,firstBody);assert.equal(result.estado_atual.status,'Em atendimento');assert.equal(result.financeiro,undefined);assert.equal(result.estado_atual.observacao,undefined);
 const good=response;
 for(const bad of [{...good,id:'other'},{...good,revision:3},{...good,status:'Concluído'},{...good,repetido:1},{...good,estado_atual:{id,revision:1,status:'Agendado',proximo_status:'Em deslocamento'}}]){response=bad;await assert.rejects(api.advanceStatus(ctx,intent));}
 for(const args of [[id,0,'Em deslocamento',attempt],[id,1,'Cancelado',attempt],[id,1,'Em deslocamento','bad'],['',1,'Em deslocamento',attempt]])assert.throws(()=>api.statusIntent(...args));
 const before=calls.length;await assert.rejects(api.agendaStatus({...ctx,url:'https://production.invalid'},id),/testes/);assert.equal(calls.length,before);
 response=good;ctx.fetch=async()=>{changed=true;return {ok:true,json:async()=>good};};await assert.rejects(api.advanceStatus(ctx,intent),/changed/);
 console.log('PASS: field status API validates intent/snapshot, reuses exact retry, strips private fields and rejects stale session or non-staging context');
})().catch(error=>{console.error(error);process.exitCode=1;});
