'use strict';
const assert=require('node:assert/strict');
const {executeJournaled,pendingIntent,journalKey}=require('../lib/settlement-journal.cjs');
const actor='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
(async()=>{
const mem=new Map(),storage={getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,v)};
let calls=0,fail=true,tail=Promise.resolve();const withLock=(key,fn)=>{const task=tail.then(fn);tail=task.catch(()=>{});return task};
const intent={rpc:'sc_registrar_recebimento',body:{p_id:'stable-id'}},result={id:'settlement',balanceCents:10};
const opts={actor,intent,storage,withLock,send:async()=>{calls++;if(fail)throw Error('network uncertain');return result}};
await assert.rejects(executeJournaled(opts),/uncertain/);assert.deepEqual(pendingIntent(storage,actor),intent);assert.equal(pendingIntent(storage,other),null);
await assert.rejects(executeJournaled({...opts,intent:{...intent,body:{p_id:'different'}}}),/mesmo ID/);assert.equal(calls,1);
fail=false;const values=await Promise.all([executeJournaled(opts),executeJournaled(opts)]);assert.deepEqual(values,[result,result]);assert.equal(calls,2,'second tab uses confirmed request');assert.equal(pendingIntent(storage,actor),null);
await assert.rejects(executeJournaled({...opts,withLock:null}),/Bloqueio/);
await assert.rejects(executeJournaled({...opts,actor:other,storage:{getItem:()=>null,setItem:()=>{throw Error('quota')}}}),/quota/);assert.equal(calls,2);
mem.set(journalKey(actor),'broken');await assert.rejects(executeJournaled(opts),/ilegível/);
console.log('PASS: account-isolated durable intents, crash retry, same-ID replay, cross-tab locking and fail-closed storage');
})().catch(e=>{console.error(e);process.exitCode=1});
