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
 assert.doesNotMatch(block,/deleteDatabase|localStorage|fetch\(/);
 console.log('PASS: IndexedDB só confirma ao concluir transação; erro/abort após sucesso da requisição rejeita, fecha conexão e não apaga/migra dados');
})().catch(e=>{console.error(e);process.exitCode=1;});
