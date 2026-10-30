const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {paymentText}=require('../lib/agenda-ledger-status.js');
const header={id:'22222222-2222-4222-8222-222222222222',status:'Fechado',unidade:'SC',parceiro_id:'33333333-3333-4333-8333-333333333333',total_centavos:35000,anterior_centavos:0};
assert.equal(paymentText(header,[{id:'a',valor_centavos:10000},{id:'b',valor_centavos:25000}]),'Quitado no fechamento');
assert.match(paymentText(header,[{id:'a',valor_centavos:10000}]),/parcial.*250,00/);
assert.match(paymentText(header,[]),/Pendente.*350,00/);
assert.equal(paymentText({...header,anterior_centavos:35000},[]),'Quitado no fechamento');
assert.equal(paymentText({...header,status:'Cancelado'},[]),null);
assert.throws(()=>paymentText(header,[{id:'a',valor_centavos:35001}]),/inconsistente/);
assert.throws(()=>paymentText(header,[{id:'a',valor_centavos:1},{id:'a',valor_centavos:1}]),/duplicado/);
const service='44444444-4444-4444-8444-444444444444',actor='11111111-1111-4111-8111-111111111111';
const row={id:service,unit:'SC',serviceContext:{partnerId:header.parceiro_id}};
function harness({paid=true,cancelled=false,offline=false,fail=false,delayed=false}={}){
 const slot={textContent:'Pendente',dataset:{agendaPaymentId:service,agendaPaymentBase:'Pendente • R$ 350,00'},removeAttribute(){}};
 let token='x.'+Buffer.from(JSON.stringify({sub:actor})).toString('base64')+'.x',release;
 const requests=[],ctx={console,Map,Set,Number,JSON,Error,URLSearchParams,document:{querySelectorAll:()=>[slot]},navigator:{onLine:!offline},localStorage:{getItem:()=>token},currentTech:()=>({cloud:true}),canSeeAgendaFinance:()=>true,serviceContextEnabled:()=>true,cloudConfig:()=>({url:'https://zzphucuiqhzrilrddxnf.supabase.co',key:'synthetic'}),ensureVistoriaSession:async()=>{},atob:v=>Buffer.from(v,'base64').toString()};ctx.window=ctx;
 ctx.fetch=async(url,options)=>{requests.push({url,options});if(delayed)await new Promise(r=>{release=r});if(fail)return {ok:false};const u=new URL(url),offset=Number(u.searchParams.get('offset')||0);let rows=[];
 if(u.pathname.endsWith('sc_fechamento_itens'))rows=offset||cancelled?[]:[{agenda_id:service,fechamento_id:header.id,fechamento:header}];
 else if(!offset)rows=[{id:'a',valor_centavos:10000}];else if(offset===1&&paid)rows=[{id:'b',valor_centavos:25000}];
 return {ok:true,json:async()=>rows};};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('lib/agenda-ledger-status.js','utf8'),ctx);
 return {slot,ctx,requests,release:()=>release(),switchAccount:()=>{token='x.'+Buffer.from(JSON.stringify({sub:service})).toString('base64')+'.x';ctx.AgendaLedgerStatus.clear();}};
}
(async()=>{
 for(const options of [{},{paid:false},{cancelled:true},{offline:true},{fail:true}]){
  const h=harness(options);await h.ctx.AgendaLedgerStatus.refresh([row]);
  if(options.cancelled)assert.equal(h.slot.textContent,'Pendente • R$ 350,00');
  else if(options.offline||options.fail)assert.match(h.slot.textContent,/não consultado/);
  else if(options.paid===false)assert.match(h.slot.textContent,/parcial/);else assert.equal(h.slot.textContent,'Quitado no fechamento');
  assert.ok(h.requests.every(r=>!r.options.method),'projection must not write or alter receipt totals');
 }
 const h=harness({delayed:true});const pending=h.ctx.AgendaLedgerStatus.refresh([row]);await new Promise(r=>setImmediate(r));h.switchAccount();h.release();await pending;assert.equal(h.slot.textContent,'Fechamento não consultado');
 const html=fs.readFileSync('index.html','utf8');assert.match(html,/data-agenda-payment-id/);assert.match(html,/AgendaLedgerStatus\?\.refresh\(filtered\)/);
 console.log('PASS: agenda ledger display, group balance, paginated receipts, cancellation, offline, no mutations and account change');
})().catch(e=>{console.error(e);process.exitCode=1});
