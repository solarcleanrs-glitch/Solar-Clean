'use strict';
const assert=require('node:assert/strict'),{create}=require('../lib/account-draft-session.cjs'),{PROJECT}=require('../lib/account-draft-vault.cjs'),{run}=require('../lib/draft-save-lock.js');
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',ID='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
let state={project:PROJECT,actor:A,generation:0},quota=false,cleared=0,quarantined=0;
const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem(k,v){if(quota)throw Error('quota');data.set(k,v);}};
const session=create({storage,context:()=>state,snapshot:()=>({cliente:'old A',photo:'synthetic'}),clear:()=>cleared++,restore(){},randomUUID:()=>ID,quarantine:()=>quarantined++});
session.begin();state={...state,actor:B};quota=true;assert.throws(()=>session.externalChange(),/quota/);assert.equal(cleared,0);assert.equal(quarantined,1);assert.equal(data.size,0);
quota=false;const out=session.externalChange();assert.equal(out.changed,true);assert.equal(cleared,1);assert.ok([...data.keys()][0].includes(A));assert.equal([...data.keys()][0].includes(B),false);assert.equal(session.externalChange().changed,false);
// Model the documented Web Locks queue: two tabs compete for one draft key.
const tails=new Map(),locks={request(name,options,callback){assert.equal(options.mode,'exclusive');const prior=tails.get(name)||Promise.resolve();const next=prior.catch(()=>{}).then(callback);tails.set(name,next);return next;}};
(async()=>{
 let rows=[],release,entered=0;const gate=new Promise(r=>release=r);
 const attempt=()=>run({locks,actor:A,draftId:ID,check(){},operation:async()=>{entered++;if(rows.length)throw Error('already saved');await gate;rows.push(ID);return ID;}});
 const first=attempt(),second=attempt();await Promise.resolve();await Promise.resolve();assert.equal(entered,1);release();assert.equal(await first,ID);await assert.rejects(second,/already saved/);assert.equal(rows.length,1);
 let called=false;await assert.rejects(run({locks:null,actor:A,draftId:ID,check(){},operation:()=>called=true}),/coordenar/);assert.equal(called,false);
 let stale=false,unlock;const held=locks.request('solarCleanDraftSave:v1:'+A+':'+ID,{mode:'exclusive'},()=>new Promise(r=>unlock=r));await Promise.resolve();await Promise.resolve();
 const waiting=run({locks,actor:A,draftId:ID,check(){if(stale)throw Error('session changed');},operation:()=>called=true});stale=true;unlock();await held;await assert.rejects(waiting,/session changed/);assert.equal(called,false);
 console.log('PASS: external account changes preserve original ownership, quota quarantines without clearing, retries retain data; exclusive save prevents duplicate and rejects stale waiters/unsupported browsers');
})().catch(e=>{console.error(e);process.exit(1)});
