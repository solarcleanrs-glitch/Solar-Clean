'use strict';
const assert=require('node:assert/strict'),api=require('../lib/field-agenda-api.js');
const client='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const ctx={url:'https://zzphucuiqhzrilrddxnf.supabase.co',headers:{},check:()=>{}};
(async()=>{
 const intent=api.contactIntent({client,outcome:'Cliente respondeu',note:'Synthetic',followup:'2026-11-10'},id);assert.equal(Object.isFrozen(intent),true);
 assert.throws(()=>api.contactIntent({client,outcome:'Unknown',note:''},id));
 assert.throws(()=>api.contactIntent({client,outcome:'Cliente respondeu',note:'',followup:'2026-02-30'},id));
 for(const followup of [false,0,NaN,{},[],true,42,'2026-02-30']){
  assert.throws(()=>api.contactIntent({client,outcome:'Cliente respondeu',note:'',followup},id));
  await assert.rejects(api.recordContact({...ctx,fetch:async()=>{throw Error('Unexpected network');}}, {p_id:id,p_cliente:client,p_resultado:'Cliente respondeu',p_observacao:'',p_retorno:followup}),/Informe datas válidas/);
 }
 for(const followup of [undefined,null,'']){
  assert.equal(api.contactIntent({client,outcome:'Cliente respondeu',note:'',followup},id).p_retorno,null);
 }
 for(const retorno of [undefined,false,0,'',{},[],'2026-02-30']){
  await assert.rejects(api.contacts({...ctx,fetch:async()=>({ok:true,json:async()=>[{id,created_at:'2026-11-02T12:00:00Z',resultado:'Cliente respondeu',observacao:'',retorno}]})},client),/Informe datas válidas/);
 }
 assert.equal(await api.canContact({...ctx,fetch:async()=>({ok:true,json:async()=>false})}),false);
 const bodies=[];let attempt=0;
 const retryCtx={...ctx,fetch:async(url,options)=>{bodies.push(options.body);if(++attempt===1)throw Error('connection lost');return {ok:true,json:async()=>({id,repetido:true})};}};
 await assert.rejects(api.recordContact(retryCtx,intent),/connection lost/);assert.equal((await api.recordContact(retryCtx,intent)).repetido,true);assert.equal(bodies[0],bodies[1]);
 let calls=0;const rows=await api.contacts({...ctx,fetch:async()=>({ok:true,json:async()=>++calls===1?[{id,created_at:'2026-11-02T12:00:00Z',resultado:'Cliente respondeu',observacao:'Synthetic',retorno:null,criado_por:'private'}]:[]})},client);
 assert.equal(rows.length,1);assert.equal(Object.hasOwn(rows[0],'criado_por'),false);
 await assert.rejects(api.recordContact({...ctx,fetch:async()=>({ok:true,json:async()=>({id:client,repetido:false})})},intent),/Confirmação/);
 let active=true;await assert.rejects(api.recordContact({...ctx,check:()=>{if(!active)throw Error('account changed');},fetch:async()=>{active=false;return {ok:true,json:async()=>({id,repetido:false})};}},intent),/account changed/);
 console.log('PASS: contact intent validation, immutable same-ID retry, private history projection, response identity and session guard');
})().catch(e=>{console.error(e);process.exit(1)});
