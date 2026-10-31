'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('function agendaMatchesOrigin('),html.indexOf('function collectAgendaContext('))+html.slice(html.indexOf('function buildAgendaMonthly('),html.indexOf('function renderAgendaMonthly('))+html.slice(html.indexOf('function buildAgendaPartnerPreview('),html.indexOf('function agendaPartnerPreviewCsv('));
const actor='11111111-1111-4111-8111-111111111111',partner='22222222-2222-4222-8222-222222222222',service='33333333-3333-4333-8333-333333333333',scope='44444444-4444-4444-8444-444444444444';
const nodes=new Map(),memory=new Map(),requests=[],headers=[],receipts=[],ids=new Map();let serial=0,uncertain=false,reject=false,accept=true,local=[];
const element=id=>{if(!nodes.has(id))nodes.set(id,{value:'',disabled:false,textContent:'',innerHTML:'',classList:{add(){},remove(){}}});return nodes.get(id)};
element('agendaMonthlyMonth').value='2026-10';element('agendaUnitFilter').value='SC';element('agendaOriginFilter').value=partner;
const moneyResult=id=>({id,status:headers[0].status,total_centavos:35000,anterior_centavos:10000,recebimentos_centavos:receipts.reduce((n,r)=>n+r.valor_centavos,0),saldo_centavos:25000-receipts.reduce((n,r)=>n+r.valor_centavos,0)});
const buttons=(attr)=>[...element('ledgerList').innerHTML.matchAll(new RegExp(attr+'="([^"]+)"','g'))].map(m=>({dataset:{[attr==='data-ledger-pay'?'ledgerPay':'ledgerCancel']:m[1]}}));
let payButtons=[],cancelButtons=[];
const ctx={console,URLSearchParams,Date,Number,JSON,Map,Set,Promise,Error,atob:x=>Buffer.from(x,'base64').toString(),crypto:{randomUUID:()=>`66666666-6666-4666-8666-${String(++serial).padStart(12,'0')}`},navigator:{onLine:true,locks:{request:async(k,fn)=>fn()}},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},document:{getElementById:element,querySelectorAll:selector=>selector==='[data-ledger-pay]'?(payButtons=buttons('data-ledger-pay')):(cancelButtons=buttons('data-ledger-cancel'))},currentTech:()=>({cloud:true}),serviceContextEnabled:()=>true,canSeeAgendaFinance:()=>true,ensureVistoriaSession:async()=>{},cloudConfig:()=>({url:'https://zzphucuiqhzrilrddxnf.supabase.co',key:'synthetic'}),agendaLocal:()=>local,escapeHtml:s=>String(s).replace(/[<>]/g,''),formatAgendaDate:()=> '2026-10-30',confirm:()=>accept,prompt:()=> 'Erro de teste'};
ctx.window=ctx;memory.set('solarCleanAccessToken','x.'+Buffer.from(JSON.stringify({sub:actor})).toString('base64')+'.x');
ctx.fetch=async(url,options={})=>{
 requests.push({url,options});const u=new URL(url),table=u.pathname.split('/').pop(),offset=Number(u.searchParams.get('offset')||0);
 if(options.method==='POST'){
  const b=JSON.parse(options.body);
  if(reject)return {ok:false,status:400,json:async()=>({code:'P0001',message:'Serviço alterado'})};
  if(!ids.has(b.p_id)){
   if(table==='sc_criar_fechamento'){assert.deepEqual(b.p_itens,[{id:service,revision:1}]);headers.push({id:b.p_id,parceiro_nome:'YES',unidade:'SC',competencia:'2026-10-01',status:'Fechado',total_centavos:35000,anterior_centavos:10000});}
   if(table==='sc_registrar_recebimento')receipts.push({id:b.p_id,valor_centavos:b.p_centavos,data_recebimento:b.p_data,forma:b.p_forma});
   ids.set(b.p_id,true);
  }
  if(uncertain){uncertain=false;throw Error('Lost response after commit');}
  return {ok:true,json:async()=>moneyResult(headers[0].id)};
 }
 let rows=[];
 if(!offset){
  if(table==='agenda_eventos')rows=[{id:service,cliente:'Synthetic',unidade:'SC',data:'2026-10-31',status:'Concluído',revision:1,sc_escopo_id:scope,valor_servico:350,gasto_extra:20,valor_cobrado:350,valor_recebido:100,escopo:{id:scope,unidade:'SC',parceiro_id:partner}}];
  if(table==='sc_fechamentos')rows=headers;
  if(table==='sc_fechamento_recebimentos')rows=receipts;
  if(table==='sc_fechamento_itens'&&headers.length)rows=[{agenda_id:service}];
 }
 return {ok:true,json:async()=>rows};
};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('lib/settlement-browser.js','utf8'),ctx);vm.runInContext(source,ctx);vm.runInContext(fs.readFileSync('lib/settlement-ui.js','utf8'),ctx);
(async()=>{
 await element('ledgerPrepare').onclick();assert.equal(element('ledgerSave').disabled,false);assert.ok(element('ledgerPrepared').innerHTML.includes('250,00'));
 accept=false;await element('ledgerSave').onclick();assert.equal(headers.length,0);
 accept=true;uncertain=true;await element('ledgerSave').onclick();assert.equal(headers.length,1);assert.ok(element('ledgerMessage').textContent.includes('mesmo ID'));
 await element('ledgerRetry').onclick();assert.equal(headers.length,1);assert.equal(element('ledgerSave').disabled,true);assert.ok(element('ledgerList').innerHTML.includes('250,00'));
 assert.equal(requests.filter(r=>r.options.method==='POST').map(r=>JSON.parse(r.options.body).p_id).every(id=>id===headers[0].id),true);
 await element('ledgerPrepare').onclick();assert.ok(element('ledgerMessage').textContent.includes('Nenhum serviço elegível'));
 payButtons[0].onclick();element('ledgerReceiptAmount').value='100,00';element('ledgerReceiptMethod').value='Pix';await element('ledgerReceiptSave').onclick();assert.equal(receipts.length,1);assert.ok(element('ledgerList').innerHTML.includes('150,00'));
 payButtons[0].onclick();element('ledgerReceiptAmount').value='999,00';await element('ledgerReceiptSave').onclick();assert.equal(receipts.length,1);assert.ok(element('ledgerMessage').textContent.includes('ultrapassa'));
 // Changing filters clears sensitive in-memory results and prepared operations.
 ctx.SCSettlementUI.clear();assert.equal(element('ledgerList').innerHTML,'');assert.equal(element('ledgerSave').disabled,true);
 element('agendaOriginFilter').value='particular';const count=requests.length;await element('ledgerLoad').onclick();assert.equal(requests.length,count);
 element('agendaOriginFilter').value=partner;headers.length=0;receipts.length=0;ids.clear();
 element('ledgerMessage').textContent='Fechamento confirmado antigo';await element('ledgerPrepare').onclick();assert.match(element('ledgerMessage').textContent,/Nenhum fechamento foi salvo/);
 reject=true;await element('ledgerSave').onclick();assert.match(element('ledgerMessage').textContent,/Nenhum novo fechamento foi criado/);assert.doesNotMatch(element('ledgerMessage').textContent,/confirmado antigo/);assert.equal(headers.length,0);reject=false;
 accept=false;await element('ledgerSave').onclick();assert.match(element('ledgerMessage').textContent,/Ação cancelada/);assert.doesNotMatch(element('ledgerMessage').textContent,/Processando/);
 assert.match(html,/lib\/settlement-browser.js/);assert.match(html,/lib\/settlement-ui.js/);
 console.log('PASS: ledger UI server preparation, confirmation, committed-response retry, partial receipt, overpayment guard, filters and cleared state');
})().catch(e=>{console.error(e);process.exitCode=1});
