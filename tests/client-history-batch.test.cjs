'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class E{constructor(tag){this.tag=tag;this.children=[];this.value='';this.checked=false;this.disabled=false;}append(n){this.children.push(n);}replaceChildren(){this.children=[];}setAttribute(){}get style(){return this._style||(this._style={});}}
const walk=n=>[n,...n.children.flatMap(walk)],find=(host,tag,text)=>walk(host).find(n=>n.tag===tag&&(!text||String(n.textContent).includes(text)));
(async()=>{
const root={},host=new E('section');let id=0,calls=[],fail=true;
vm.runInNewContext(fs.readFileSync('lib/client-history-batch.js','utf8'),{window:root,document:{createElement:t=>new E(t)},crypto:{randomUUID:()=>String(++id)}});
const api=root.SCClientHistoryBatch.mount(host,{origins:()=>[['','Selecione'],['particular','Particular']],busy(){},refresh:async()=>{},plan:(c,r)=>{if(!r.fields.unidade)throw Error('Unidade');return c.events.map(e=>({params:{p_agenda:'a',p_evento:e.id,p_cliente_id:r.clientId,p_cadastro:{...r.fields}}}));},run:async(r,guard)=>{guard();calls.push(JSON.parse(JSON.stringify(r)));if(r.params.p_evento==='b'&&fail)throw Error('Sem rede');}});
const c=(id)=>({suggestedName:'Pessoa '+id,phoneCandidates:[],addressSuggestion:'Endereço '+id,unitSuggestion:'RS',originSuggestion:'Particular',flags:[],events:[{id,summary:'<img src=x>',sourceKey:'a:'+id}]});
api.load([c('a'),c('b')]);api.access(true,[]);
const checks=()=>walk(host).filter(n=>n.type==='checkbox');checks().forEach(n=>{n.checked=true;n.onchange();});
await find(host,'button','Importar').onclick();assert.deepEqual(calls.map(r=>r.params.p_evento),['a','b']);assert.match(walk(host).find(n=>n.textContent?.startsWith('Lote interrompido')).textContent,/retomar/);
assert.ok(checks().every(n=>n.disabled),'Freeze pending decisions after ambiguity');
fail=false;await find(host,'button','Importar').onclick();assert.deepEqual(calls.map(r=>r.params.p_evento),['a','b','b']);assert.deepEqual(calls[1],calls[2],'Retry exact ID and payload');
assert.match(walk(host).find(n=>n.textContent?.startsWith('Lote concluído')).textContent,/concluído/);
api.clear();assert.equal(checks().length,0);
api.load([c('x'),c('x')]);api.access(true,[]);checks().forEach(n=>{n.checked=true;n.onchange();});await find(host,'button','Importar').onclick();assert.equal(calls.length,3,'Duplicate people blocked before first write');
const bad=c('z');bad.unitSuggestion=null;api.load([c('y'),bad]);api.access(true,[]);checks().forEach(n=>{n.checked=true;n.onchange();});await find(host,'button','Importar').onclick();assert.equal(calls.length,3,'Whole batch prevalidated');
console.log('PASS: lote exige revisão, valida antes de enviar, interrompe e retoma payload exato sem reenviar confirmados; limpa e bloqueia duplicidade');
})().catch(e=>{console.error(e);process.exitCode=1;});
