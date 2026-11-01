'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('index.html','utf8');
const block=source.slice(source.indexOf('async function runVistoriaStore('),source.indexOf('/* ---------- UI helpers ---------- */'));
function setup(){let closed=0,opened=0;const req={},tx={objectStore:()=>({put:()=>req,add:()=>req,getAll:()=>req,delete:()=>req}),abort(){this.onabort();}};const ctx={STORE:'vistorias',openDB:async()=>{opened++;return {transaction:()=>tx,close:()=>{closed++;}};},Error,String};vm.createContext(ctx);vm.runInContext(block,ctx);return {ctx,req,tx,closed:()=>closed,opened:()=>opened};}
(async()=>{
 let s=setup(),done=false,p=s.ctx.dbAdd({cliente:'sintético'}).then(x=>{done=true;return x;});await new Promise(resolve=>setImmediate(resolve));s.req.result=7;s.req.onsuccess();await new Promise(resolve=>setImmediate(resolve));assert.equal(done,false,'Request success must not acknowledge saving');s.tx.oncomplete();assert.equal(await p,7);assert.equal(s.closed(),1);
 s=setup();p=s.ctx.dbPut({id:7});await new Promise(resolve=>setImmediate(resolve));s.req.result=7;s.req.onsuccess();s.tx.error=Error('Quota');s.tx.onabort();await assert.rejects(p,/Quota/);assert.equal(s.closed(),1);
 s=setup();p=s.ctx.dbAdd({});await new Promise(resolve=>setImmediate(resolve));s.req.error=Error('Duplicate');s.req.onerror();s.tx.onabort();await assert.rejects(p,/Duplicate/);
 s=setup();p=s.ctx.dbAll();await new Promise(resolve=>setImmediate(resolve));s.req.result=[{id:1},{id:2,createdAt:'2026-10-31'},{id:3,createdAt:'2025-01-01'}];s.req.onsuccess();s.tx.oncomplete();assert.deepEqual(Array.from(await p,r=>r.id),[2,3,1]);assert.equal(s.closed(),1);
 s=setup();done=false;p=s.ctx.dbDelete(1).then(()=>{done=true;});await new Promise(resolve=>setImmediate(resolve));s.req.onsuccess();await new Promise(resolve=>setImmediate(resolve));assert.equal(done,false);s.tx.oncomplete();await p;
 s=setup();s.ctx.openDB=async()=>{throw Error('Open failed');};await assert.rejects(s.ctx.dbAll(),/Open failed/);
 // A switch while the DB is opening must prevent the transaction from starting.
 s=setup();let changed=false,releaseOpen,transactions=0;
 s.ctx.captureVistoriaOperationGuard=()=>()=>{if(changed)throw Error('Conta mudou');};
 s.ctx.openDB=()=>new Promise(resolve=>{releaseOpen=()=>resolve({transaction:()=>{transactions++;return s.tx;},close:()=>{}});});
 p=s.ctx.dbPut({id:1});changed=true;releaseOpen();await assert.rejects(p,/Conta mudou/);assert.equal(transactions,0);
 // Request success after a switch aborts instead of acknowledging a save.
 s=setup();changed=false;s.ctx.captureVistoriaOperationGuard=()=>()=>{if(changed)throw Error('Conta mudou');};
 p=s.ctx.dbAdd({id:1});await new Promise(resolve=>setImmediate(resolve));changed=true;s.req.result=1;s.req.onsuccess();await assert.rejects(p,/Conta mudou/);assert.equal(s.closed(),1);
 // A result already committed under the old context must not be delivered to the new UI.
 s=setup();changed=false;s.ctx.captureVistoriaOperationGuard=()=>()=>{if(changed)throw Error('Conta mudou');};
 p=s.ctx.dbAll();await new Promise(resolve=>setImmediate(resolve));s.req.result=[];s.req.onsuccess();changed=true;s.tx.oncomplete();await assert.rejects(p,/Conta mudou/);
 assert.doesNotMatch(block,/deleteDatabase|localStorage|fetch\(/);
 console.log('PASS: IndexedDB só confirma ao concluir transação; erro/abort após sucesso da requisição rejeita, fecha conexão e não apaga/migra dados');
})().catch(e=>{console.error(e);process.exitCode=1;});
