'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {prepareReview}=require('../lib/google-history-review.cjs'),{plan}=require('../lib/client-history-import-plan.cjs');
class Element{constructor(){this.value='';this.files=[];this.checked=false;this.disabled=false;this.children=[];this.classList={remove(){}};}replaceChildren(){this.children=[];this.value='';}append(e){this.children.push(e);if(this.children.length===1)this.value=e.value;}set innerHTML(v){this.html=v;}}
(async()=>{
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};let schema=false,imports=0;
 const listeners={},ctx={location:{hostname:'solar-clean-testes-crm.pages.dev'},document:{getElementById:get,createElement:()=>new Element()},window:{addEventListener:(name,fn)=>{listeners[name]=fn;}},captureStagingBackupLocal:()=>({actor:'11111111-1111-4111-8111-111111111111'}),currentTech:()=>({cloud:true}),cloudConfig:()=>({url:'https://zzphucuiqhzrilrddxnf.supabase.co'}),crmHistoryCloudHeaders:()=>({}),ensureVistoriaSession:async()=>{},navigator:{locks:{request:async(k,fn)=>fn()}},crypto:{randomUUID:()=> '22222222-2222-4222-8222-222222222222'},SCClientHistoryReview:{prepareReview},SCClientHistoryImportPlan:{plan},SCClientHistoryImportAPI:{run:async({request})=>{imports++;assert.equal(request.params.p_cadastro.unidade,'SC');return {cliente_id:request.params.p_cliente_id};}},localStorage:{},AbortSignal,fetch:async url=>url.includes('sc_is_manager')?{ok:true,json:async()=>true}:url.includes('sc_clientes?')?{ok:schema,status:schema?200:404}:{ok:true,json:async()=>[]}};
 vm.runInNewContext(fs.readFileSync('lib/client-history-ui.js','utf8'),ctx);
 assert.equal(get('chiImport').disabled,true);
 get('chiFile').files=[{size:200,text:async()=>JSON.stringify({format:'solar-clean-google-calendar-history-v1',paginationComplete:true,sourceCalendar:'test@example.invalid',events:[{id:'a',status:'confirmed',summary:'<img src=x>',description:'Telefone: (51) 99999-1234',location:'SC'}]})}];
 await get('chiFile').onchange();assert.equal(get('chiName').value,'<img src=x>');assert.equal(get('chiUnit').value,'');
 await get('chiCheck').onclick();assert.match(get('chiStatus').textContent,/instalada/);assert.equal(get('chiImport').disabled,true);
 schema=true;await get('chiCheck').onclick();get('chiAck').checked=true;get('chiAck').onchange();
 await get('chiImport').onclick();assert.equal(imports,0,'Unidade/origem não podem ser inferidas da sugestão');
 get('chiUnit').value='SC';get('chiOrigin').value='nao_informada';await get('chiImport').onclick();assert.equal(imports,1);assert.match(get('chiStatus').textContent,/confirmado/);assert.equal(get('chiAck').checked,false);
 listeners.storage({key:'solarCleanAccessToken'});assert.equal(get('chiName').value,'');assert.equal(get('chiOriginal').textContent,'');assert.equal(get('chiImport').disabled,true);
 assert.ok(!fs.readFileSync('lib/client-history-ui.js','utf8').includes('innerHTML=event'));
 console.log('PASS: tela exige schema/gestor, seleção e revisão explícitas, escapa dados e limpa conteúdo na troca de sessão');
})().catch(e=>{console.error(e);process.exitCode=1;});
