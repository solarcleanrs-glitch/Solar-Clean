'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {prepareReview}=require('../lib/google-history-review.cjs'),{plan}=require('../lib/client-history-import-plan.cjs');
class Element{constructor(){this.value='';this.files=[];this.checked=false;this.disabled=false;this.children=[];this.classList={remove(){}};}replaceChildren(){this.children=[];this.value='';}append(e){this.children.push(e);if(this.children.length===1)this.value=e.value;}set innerHTML(v){this.html=v;}}
(async()=>{
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};let schema=false,imports=0;const requests=[];const existing={importedClientId:'44444444-4444-4444-8444-444444444444',cliente:'Existente sintético',telefone:'',cidade:'Cidade conferida',endereco:'Endereço conferido',unidade:'SC',origem:'nao_informada',parceiroId:null};
 const listeners={},ctx={location:{hostname:'solar-clean-testes-crm.pages.dev'},document:{getElementById:get,createElement:()=>new Element()},window:{addEventListener:(name,fn)=>{listeners[name]=fn;}},captureStagingBackupLocal:()=>({actor:'11111111-1111-4111-8111-111111111111'}),currentTech:()=>({cloud:true}),cloudConfig:()=>({url:'https://zzphucuiqhzrilrddxnf.supabase.co'}),crmHistoryCloudHeaders:()=>({}),ensureVistoriaSession:async()=>{},navigator:{locks:{request:async(k,fn)=>fn()}},crypto:{randomUUID:()=> '22222222-2222-4222-8222-222222222222'},SCImportedClientsCRM:{read:async()=>[existing]},SCClientHistoryReview:{prepareReview},SCClientHistoryImportPlan:{plan},SCClientHistoryImportAPI:{run:async({request})=>{imports++;requests.push(request);assert.equal(request.params.p_cadastro.unidade,'SC');return {cliente_id:request.params.p_cliente_id};}},localStorage:{},AbortSignal,fetch:async url=>url.includes('sc_is_manager')?{ok:true,json:async()=>true}:url.includes('sc_clientes?')?{ok:schema,status:schema?200:404}:{ok:true,json:async()=>[]}};
 vm.runInNewContext(fs.readFileSync('lib/client-history-ui.js','utf8'),ctx);
 assert.equal(get('chiImport').disabled,true);
 get('chiFile').files=[{size:200,text:async()=>JSON.stringify({format:'solar-clean-google-calendar-history-v1',paginationComplete:true,sourceCalendar:'test@example.invalid',events:[{id:'a',status:'confirmed',summary:'<img src=x>',description:'Telefone: (51) 99999-1234',location:'SC'}]})}];
 await get('chiFile').onchange();assert.equal(get('chiName').value,'<img src=x>');assert.equal(get('chiUnit').value,'');
 await get('chiCheck').onclick();assert.match(get('chiStatus').textContent,/instalada/);assert.equal(get('chiImport').disabled,true);
 schema=true;await get('chiCheck').onclick();get('chiMode').value='new';get('chiMode').onchange();get('chiAck').checked=true;get('chiAck').onchange();
 await get('chiImport').onclick();assert.equal(imports,0,'Unidade/origem não podem ser inferidas da sugestão');
 get('chiUnit').value='SC';get('chiOrigin').value='nao_informada';await get('chiImport').onclick();assert.equal(imports,1);assert.match(get('chiStatus').textContent,/confirmado/);assert.equal(get('chiAck').checked,false);
 get('chiMode').value='existing';get('chiMode').onchange();assert.equal(get('chiName').disabled,true);assert.equal(get('chiImport').disabled,true);
 get('chiTarget').value=existing.importedClientId;get('chiTarget').onchange();assert.equal(get('chiName').value,existing.cliente);assert.equal(get('chiAck').checked,false);
 get('chiName').value='Tentativa de alterar campo bloqueado';get('chiAck').checked=true;get('chiAck').onchange();await get('chiImport').onclick();
 assert.equal(imports,2);assert.equal(requests[1].params.p_cliente_id,existing.importedClientId);assert.equal(requests[1].targetMode,'existing');assert.equal(requests[1].params.p_cadastro.cliente,existing.cliente);assert.match(get('chiStatus').textContent,/vinculado/);
 get('chiTargetSearch').value='inexistente';get('chiTargetSearch').oninput();assert.equal(get('chiTarget').value,'');assert.equal(get('chiImport').disabled,true);
 listeners.storage({key:'solarCleanAccessToken'});assert.equal(get('chiName').value,'');assert.equal(get('chiOriginal').textContent,'');assert.equal(get('chiImport').disabled,true);
 assert.ok(!fs.readFileSync('lib/client-history-ui.js','utf8').includes('innerHTML=event'));
 console.log('PASS: tela exige schema/gestor, seleção e revisão explícitas, escapa dados e limpa conteúdo na troca de sessão');
})().catch(e=>{console.error(e);process.exitCode=1;});
