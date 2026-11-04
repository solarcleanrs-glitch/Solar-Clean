'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),api=require('../lib/field-agenda-api.js');
const nodes=new Map(),events={};let actor='A',online=true,allowed=true,snapshotCalls=0;
class Element{
 constructor(fragment=false){this.children=[];this.fragment=fragment;this.value='';this.textContent='';this.disabled=false;this.style={};}
 set id(id){this._id=id;nodes.set(id,this);}get id(){return this._id;}
 set innerHTML(value){for(const[,id]of value.matchAll(/id="([^"]+)"/g)){const node=new Element();node.id=id;}}
 append(...items){for(const item of items)this.children.push(...(item.fragment?item.children:[item]));}
 replaceChildren(...items){this.children=[];this.append(...items);}setAttribute(k,v){this[k]=v;}
}
const id='legacy/event',row={id,cliente:'Synthetic',data:'2026-11-04',hora:'10:00',unidade:'RS',status:'Agendado'};
let snapshot=async()=>({id,revision:1,status:'Agendado',proximo_status:'Em deslocamento'}),advance=async()=>{throw Error('network lost');};
const window={addEventListener:(name,fn)=>events[name]=fn,fetch(){},SCFieldAgenda:{read:async()=>[row],canAdvanceStatus:async()=>allowed,agendaStatus:async()=>{snapshotCalls++;return snapshot();},statusIntent:api.statusIntent,advanceStatus:async(ctx,intent)=>advance(ctx,intent)}};
vm.runInNewContext(fs.readFileSync('lib/field-agenda-ui.js','utf8'),{window,location:{hostname:'solar-clean-testes-crm.pages.dev'},document:{querySelector:()=>new Element(),getElementById:id=>nodes.get(id),createElement:()=>new Element(),createDocumentFragment:()=>new Element(true)},navigator:{get onLine(){return online;}},currentTech:()=>({cloud:true}),captureVistoriaOperationGuard:()=>{const before=actor;return()=>{if(actor!==before)throw Error('changed');};},ensureVistoriaSession:async()=>{},cloudConfig:()=>({url:'staging'}),crmHistoryCloudHeaders:()=>({}),URL:{revokeObjectURL(){}},crypto:{randomUUID:()=> '11111111-1111-4111-8111-111111111111'},Date,Set,Error,String,Object});
const el=id=>nodes.get(id),flush=()=>new Promise(resolve=>setImmediate(resolve)),card=()=>el('fieldAgendaRows').children[0],button=()=>card().children.find(x=>x.textContent==='Atualizar atendimento');
async function open(){button().onclick();await flush();await flush();return card().children.at(-1);}
(async()=>{
 allowed=false;await el('fieldAgendaLoad').onclick();assert.equal(button(),undefined);
 allowed=true;await el('fieldAgendaLoad').onclick();let box=await open(),confirm=box.children.find(x=>x.textContent==='Confirmar: Em deslocamento');assert.ok(confirm);
 const sent=[];advance=async(ctx,intent)=>{sent.push(intent);if(sent.length===1)throw Error('network lost');return {estado_atual:{status:'Em atendimento'}};};
 await confirm.onclick();assert.match(confirm.textContent,/Repetir/);assert.equal(confirm.disabled,false);
 await confirm.onclick();assert.deepEqual(sent[0],sent[1]);assert.equal(Object.isFrozen(sent[0]),true);assert.equal(card().children[2].textContent,'Em atendimento');assert.equal(confirm.disabled,true);assert.equal(button().disabled,false);
 snapshot=async()=>({id,revision:3,status:'Em atendimento',proximo_status:'Concluído'});box=await open();assert.ok(box.children.some(x=>x.textContent==='Confirmar: Concluído'));assert.equal(sent.length,2,'opening editor must not advance automatically');
 let release;snapshot=()=>new Promise(resolve=>release=resolve);button().disabled=false;button().onclick();await flush();const staleBox=card().children.at(-1);actor='B';window.SCFieldAgendaUI.clear();release({id,revision:1,status:'Agendado',proximo_status:'Em deslocamento'});await flush();await flush();assert.equal(staleBox.children.length,0,'late snapshot cannot rebuild old account editor');
 snapshot=async()=>({id,revision:1,status:'Agendado',proximo_status:'Em deslocamento'});await el('fieldAgendaLoad').onclick();box=await open();confirm=box.children.find(x=>x.textContent==='Confirmar: Em deslocamento');advance=()=>new Promise(resolve=>release=resolve);
 const pending=confirm.onclick();await flush();el('fieldAgendaUnit').onchange();release({estado_atual:{status:'Em deslocamento'}});await pending;assert.equal(box.children.length,0,'late write confirmation cannot refill changed filters');
 snapshot=async()=>({id,revision:4,status:'Concluído',proximo_status:null});await el('fieldAgendaLoad').onclick();box=await open();assert.equal(box.children.some(x=>x.type==='button'),false);assert.match(box.children[0].textContent,/Não há próximo/);
 snapshot=async()=>({id,revision:1,status:'Agendado',proximo_status:'Em deslocamento'});const before=snapshotCalls;online=false;box=await open();assert.equal(snapshotCalls,before);assert.match(box.children[0].textContent,/internet/);
 console.log('PASS: field UI hides unauthorized action, requires explicit confirmation, repeats immutable intent, shows current status and discards stale account/filter results');
})().catch(error=>{console.error(error);process.exitCode=1;});
