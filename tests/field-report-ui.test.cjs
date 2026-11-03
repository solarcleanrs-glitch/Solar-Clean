'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const nodes=new Map(),events={},revoked=[];let actor='A',deferred=null;
class Element{
 constructor(){this.children=[];this.style={};this.value='';this.disabled=false;this.textContent='';}
 set id(value){this._id=value;nodes.set(value,this);}get id(){return this._id;}
 set innerHTML(value){for(const [,id]of value.matchAll(/id="([^"]+)"/g)){const el=new Element();el.id=id;}}
 append(...items){this.children.push(...items);}replaceChildren(...items){this.children=[...items];}
 setAttribute(name,value){this[name]=value;}
}
const home=new Element(),owner='11111111-1111-4111-8111-111111111111';
const row={client_uuid:owner,cliente:'Synthetic',created_at:'2026-10-29T02:59:59Z',unidade:'RS'};
const window={addEventListener:(name,fn)=>events[name]=fn,fetch:()=>{},SCFieldAgenda:{
 reports:async()=>deferred?await deferred.promise:[row],
 report:async()=>({client_uuid:owner,cliente:'Synthetic',placas:0,obs:'PRIVATE',valor_cobrado:'PRIVATE',media_manifest:[{category:'Antes'}]}),
 photo:async()=>({}),read:async()=>[],clients:async()=>[]}};
vm.runInNewContext(fs.readFileSync('lib/field-agenda-ui.js','utf8'),{window,location:{hostname:'solar-clean-testes-crm.pages.dev'},document:{querySelector:()=>home,getElementById:id=>nodes.get(id),createElement:()=>new Element(),createDocumentFragment:()=>new Element()},navigator:{onLine:true},currentTech:()=>({cloud:true}),captureVistoriaOperationGuard:()=>{const before=actor;return()=>{if(actor!==before)throw Error('account changed');};},ensureVistoriaSession:async()=>{},cloudConfig:()=>({url:'staging'}),crmHistoryCloudHeaders:()=>({}),URL:{createObjectURL:()=> 'blob:synthetic',revokeObjectURL:url=>revoked.push(url)},crypto:{randomUUID:()=> '22222222-2222-4222-8222-222222222222'},Date,Set,Error,String,Object});
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
 window.SCFieldAgenda.clients=async()=>[{cliente:'Synthetic imported',telefone:'',cidade:'City',endereco:'Street',unidade:'RS',origem:'particular'}];
 await el('fieldClientsLoad').onclick();assert.equal(el('fieldClientsRows').children.length,1);
 el('fieldClientsSearch').value='old account search';window.SCFieldAgendaUI.clear();assert.equal(el('fieldClientsRows').children.length,0);assert.equal(el('fieldClientsSearch').value,'');
 let release;window.SCFieldAgenda.clients=()=>new Promise(r=>release=r);
 const oldClients=el('fieldClientsLoad').onclick();await flush();el('fieldClientsSearch').value='new query';el('fieldClientsSearch').oninput();release([{cliente:'stale'}]);await oldClients;
 assert.equal(el('fieldClientsRows').children.length,0,'late client search cannot refill the screen');assert.equal(el('fieldClientsLoad').disabled,false);
 const realAPI=require('../lib/field-agenda-api.js');window.SCFieldAgenda.canContact=async()=>true;window.SCFieldAgenda.outcomes=realAPI.outcomes;window.SCFieldAgenda.contactIntent=realAPI.contactIntent;
 window.SCFieldAgenda.clients=async()=>[{id:owner,cliente:'Synthetic imported',unidade:'RS',origem:'particular'}];window.SCFieldAgenda.contacts=async()=>[];
 await el('fieldClientsLoad').onclick();el('fieldClientsRows').children[0].children.at(-1).onclick();await flush();await flush();
 assert.ok(el('fieldContactSave'));el('fieldContactNote').value='Original note';el('fieldContactFollowup').value='2026-11-10';
 const saved=[];window.SCFieldAgenda.recordContact=async(ctx,intent)=>{saved.push(intent);if(saved.length===1)throw Error('network lost');return {id:intent.p_id,repetido:true};};
 await el('fieldContactSave').onclick();assert.equal(el('fieldContactNote').disabled,true);el('fieldContactNote').value='Changed after uncertain response';
 await el('fieldContactSave').onclick();assert.deepEqual(saved[0],saved[1]);assert.equal(saved[1].p_observacao,'Original note');assert.equal(el('fieldContactSave').disabled,true);
 console.log('PASS: actual UI renders zero safely, hides unapproved fields, uses Brazil date, revokes photo URLs on account switch and rejects late filter results');
})().catch(e=>{console.error(e);process.exit(1)});
