'use strict';
const assert=require('node:assert/strict'),{create,validate,PROJECT,CAPS}=require('../lib/operational-access.js');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const profile=(actor=A,role='gestor_unidade')=>({version:1,actor,role,units:['RS'],revision:'1'.repeat(32),capabilities:Object.fromEntries(CAPS.map(k=>[k,role==='tecnico'?['agenda_read','reports_read'].includes(k):k!=='access_admin']))});
(async()=>{
 let ctx={project:PROJECT,actor:A,generation:1,headers:{Authorization:'Bearer synthetic'}},clock=0,body=profile(),ok=true,calls=0;
 const api=create({context:()=>ctx,now:()=>clock,fetch:async()=>{calls++;return{ok,status:ok?200:403,json:async()=>body};}});
 assert.equal(api.allows('finance'),false);await api.refresh();assert.equal(api.allows('finance','RS'),true);assert.equal(api.allows('finance','SC'),false);assert.equal(api.allows('access_admin'),false);
 clock=60000;assert.equal(api.current(),null);await api.refresh();assert.equal(Object.isFrozen(api.current().units),true);
 ok=false;await assert.rejects(api.refresh(),/403/);assert.equal(api.current(),null,'failed refresh cannot retain prior permissions');ok=true;
 let release;const pending=create({context:()=>ctx,fetch:()=>new Promise(r=>{release=r;})});
 const first=pending.refresh();ctx={...ctx,actor:B};release({ok:true,json:async()=>profile()});await assert.rejects(first,/sessão mudou/);assert.equal(pending.current(),null);
 ctx={...ctx,actor:A};let done;calls=0;const single=create({context:()=>ctx,fetch:()=>{calls++;return new Promise(r=>{done=r;});}});
 const one=single.refresh(),two=single.refresh();assert.equal(calls,1);done({ok:true,json:async()=>profile()});await Promise.all([one,two]);single.clear();assert.equal(single.current(),null);
 let complete;const renewing=create({context:()=>ctx,now:()=>clock,fetch:async()=>({ok:true,json:async()=>profile()})});await renewing.refresh();
 const steady=renewing.current();const keep=create({context:()=>ctx,now:()=>clock,fetch:(()=>{let n=0;return()=>++n===1?Promise.resolve({ok:true,json:async()=>profile()}):new Promise(resolve=>{complete=resolve;});})()});await keep.refresh();const inProgress=keep.refresh();assert.equal(keep.current().revision,steady.revision,'unexpired confirmed grants survive a renewal in progress');complete({ok:false,status:403});await assert.rejects(inProgress,/403/);assert.equal(keep.current(),null,'a denied renewal always removes the prior grant');
 assert.equal(validate(profile(A,'tecnico'),A).capabilities.crm,false);
 const invalid=profile(A,'tecnico');invalid.capabilities.finance=true;assert.throws(()=>validate(invalid,A),/incompatíveis/);
 for(const mutate of [p=>p.actor=B,p=>p.units.push('RS'),p=>p.units=['unknown'],p=>delete p.capabilities.crm,p=>p.capabilities.access_admin=true,p=>p.revision='x']){const p=profile();mutate(p);assert.throws(()=>validate(p,A));}
 ctx={...ctx,project:'https://official.invalid'};calls=0;const wrong=create({context:()=>ctx,fetch:async()=>{calls++;}});await assert.rejects(wrong.refresh(),/projeto de testes/);assert.equal(calls,0);
 console.log('PASS: server capability validation, RS/SC, deny unsupported grants, expiry, failed refresh, single flight, stale response and wrong project');
})().catch(e=>{console.error(e);process.exitCode=1;});
