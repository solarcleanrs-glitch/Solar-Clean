'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const nodes=new Map(),events={},revoked=[];let actor='A',deferred=null;
class Element{
 constructor(){this.children=[];this.style={};this.value='';this.disabled=false;this.textContent='';}
 set id(value){this._id=value;nodes.set(value,this);}get id(){return this._id;}
 set innerHTML(value){for(const [,id]of value.matchAll(/id="([^"]+)"/g)){const el=new Element();el.id=id;}}
 append(...items){this.children.push(...items);}replaceChildren(...items){this.children=[...items];}
}
const home=new Element(),owner='11111111-1111-4111-8111-111111111111';
const row={client_uuid:owner,cliente:'Synthetic',created_at:'2026-10-29T02:59:59Z',unidade:'RS'};
const window={addEventListener:(name,fn)=>events[name]=fn,fetch:()=>{},SCFieldAgenda:{
 reports:async()=>deferred?await deferred.promise:[row],
 report:async()=>({client_uuid:owner,cliente:'Synthetic',placas:0,obs:'PRIVATE',valor_cobrado:'PRIVATE',media_manifest:[{category:'Antes'}]}),
 photo:async()=>({}),read:async()=>[]}};
vm.runInNewContext(fs.readFileSync('lib/field-agenda-ui.js','utf8'),{window,location:{hostname:'solar-clean-testes-crm.pages.dev'},document:{querySelector:()=>home,getElementById:id=>nodes.get(id),createElement:()=>new Element(),createDocumentFragment:()=>new Element()},navigator:{onLine:true},currentTech:()=>({cloud:true}),captureVistoriaOperationGuard:()=>{const before=actor;return()=>{if(actor!==before)throw Error('account changed');};},ensureVistoriaSession:async()=>{},cloudConfig:()=>({url:'staging'}),crmHistoryCloudHeaders:()=>({}),URL:{createObjectURL:()=> 'blob:synthetic',revokeObjectURL:url=>revoked.push(url)},Date,Set,Error,String,Object});
const el=id=>nodes.get(id),flush=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 await el('fieldReportsLoad').onclick();assert.equal(el('fieldReportsRows').children.length,1);
 assert.match(el('fieldReportsRows').children[0].textContent,/28\/10\/2026/,'Brazil date, not UTC');
 el('fieldReportsRows').children[0].onclick();await flush();await flush();
 const view=el('fieldReportDetail').children[0];assert.ok(view);
 const text=view.children.map(x=>x.textContent).join(' ');assert.match(text,/Placas: 0/);assert.equal(text.includes('PRIVATE'),false);
 const photoButton=view.children.at(-1).children[0];await photoButton.onclick();assert.equal(view.children.at(-1).children.length,2);
 actor='B';window.SCFieldAgendaUI.clear();assert.equal(el('fieldReportDetail').children.length,0);assert.deepEqual(revoked,['blob:synthetic']);
 let resolve;deferred={promise:new Promise(r=>resolve=r)};const pending=el('fieldReportsLoad').onclick();await flush();
 el('fieldAgendaUnit').value='SC';el('fieldAgendaUnit').onchange();resolve([row]);await pending;
 assert.equal(el('fieldReportsRows').children.length,0,'late result cannot refill changed filters');assert.equal(el('fieldReportsLoad').disabled,false);
 console.log('PASS: actual UI renders zero safely, hides unapproved fields, uses Brazil date, revokes photo URLs on account switch and rejects late filter results');
})().catch(e=>{console.error(e);process.exit(1)});
