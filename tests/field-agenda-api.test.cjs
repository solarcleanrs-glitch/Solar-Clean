'use strict';
const assert=require('node:assert/strict');
const api=require('../lib/field-agenda-api.js');
const url='https://zzphucuiqhzrilrddxnf.supabase.co';
const input={start:'2026-10-01',end:'2026-10-31',unit:'RS'};
const row={id:'legacy:1',cliente:'Synthetic',unidade:'RS',data:'2026-10-28',hora:'09:00',valor_cobrado:999,observacao:'private'};
(async()=>{
 for(const bad of [{...input,start:'2026-02-30'},{...input,end:'2026-09-30'},{...input,end:'2027-01-02'},{...input,unit:'XX'}])assert.throws(()=>api.parameters(bad));
 let calls=[];const fetch=async(endpoint,options)=>{
  calls.push({endpoint,options});return {ok:true,json:async()=>calls.length===1?[row]:[]};
 };
 const rows=await api.read({url,input,headers:{Authorization:'Bearer synthetic'},fetch,check:()=>{}});
 assert.equal(rows[0].id,'legacy:1');assert.equal(Object.hasOwn(rows[0],'valor_cobrado'),false);assert.equal(Object.hasOwn(rows[0],'observacao'),false);
 assert.match(calls[1].endpoint,/offset=1$/,'handles server row cap smaller than requested page size');
 assert.equal(calls[0].options.method,'POST');assert.deepEqual(JSON.parse(calls[0].options.body),{p_inicio:input.start,p_fim:input.end,p_unidade:'RS'});
 await assert.rejects(api.read({url:'https://production.invalid',input,fetch,check:()=>{}}),/somente/);
 let failedCalls=0;
 await assert.rejects(api.read({url,input,fetch:async()=>{failedCalls++;return {ok:false,status:403};},check:()=>{}}),/recusada/);
 assert.equal(failedCalls,1,'no direct-table or local fallback on denied request');
 await assert.rejects(api.read({url,input,fetch:async()=>({ok:true,json:async()=>[row]}),check:()=>{}}),/repetida/);
 for(const invalid of [{...row,unidade:'SC'},{...row,data:'2026-11-01'},{...row,data:null}])
  await assert.rejects(api.read({url,input,fetch:async()=>({ok:true,json:async()=>[invalid]}),check:()=>{}}));
 let active=true;
 await assert.rejects(api.read({url,input,fetch:async()=>{active=false;return {ok:true,json:async()=>[row]};},check:()=>{if(!active)throw Error('actor changed');}}),/actor changed/);
 active=true;
 await assert.rejects(api.read({url,input,fetch:async()=>({ok:true,json:async()=>{active=false;return [row];}}),check:()=>{if(!active)throw Error('actor changed during JSON');}}),/during JSON/);
 console.log('PASS: field API validates dates, paginates, strips extra fields, rejects denied/malformed responses and session changes without fallback');
})().catch(e=>{console.error(e);process.exit(1)});
