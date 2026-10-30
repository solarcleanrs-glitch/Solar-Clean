/* Staging ledger UI. All authorization and monetary mutations remain server enforced. */
(()=>{
'use strict';
let generation=0,busy=false,prepared=null,listed=new Map();
const $s=id=>document.getElementById(id),api=window.SCSettlement;
const brl=n=>(n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
function clear(){generation++;prepared=null;listed.clear();$s('ledgerSave').disabled=true;$s('ledgerPrepared').innerHTML='';$s('ledgerList').innerHTML='';$s('ledgerMessage').textContent='';$s('ledgerReceiptForm').classList.add('hidden');}
window.SCSettlementUI={clear};
function actor(){
 if(!currentTech()?.cloud)throw Error('Entre na nuvem para consultar fechamentos.');
 let sub;try{sub=JSON.parse(atob((localStorage.getItem('solarCleanAccessToken')||'').split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub;}catch(e){}
 if(!/^[0-9a-f-]{36}$/i.test(sub||''))throw Error('Sessão inválida. Entre novamente.');return sub;
}
function filters(){
 const month=$s('agendaMonthlyMonth').value,unit=$s('agendaUnitFilter').value,partnerId=$s('agendaOriginFilter').value;
 // The pure adapter validates partner, month and unit before any lookup.
 api.createIntent({id:'00000000-0000-4000-8000-000000000001',partnerId,unit,month,items:[{id:'00000000-0000-4000-8000-000000000002',revision:1}]});
 return {month,unit,partnerId};
}
async function context(){
 const gen=generation;
 if(!serviceContextEnabled()||!canSeeAgendaFinance())throw Error('Consulta restrita ao gestor no ambiente de testes.');
 const previous=actor();await ensureVistoriaSession();
 if(gen!==generation||actor()!==previous)throw Error('Sessão ou filtros alterados. Consulte novamente.');
 const config=cloudConfig();if(config.url!=='https://zzphucuiqhzrilrddxnf.supabase.co'||!navigator.onLine)throw Error('Conexão com o projeto de testes obrigatória.');
 return {gen,actor:previous,...filters(),connection:{url:config.url,key:config.key,accessToken:localStorage.getItem('solarCleanAccessToken')}};
}
function check(ctx){if(ctx.gen!==generation||actor()!==ctx.actor||JSON.stringify(filters())!==JSON.stringify({month:ctx.month,unit:ctx.unit,partnerId:ctx.partnerId}))throw Error('Sessão ou filtros alterados. Consulte novamente.');}
async function pages(ctx,table,params){
 const rows=[],seen=new Set();let offset=0;
 for(;;){
  check(ctx);const query=new URLSearchParams({...params,order:'id.asc',limit:'100',offset:String(offset)});
  const response=await fetch(ctx.connection.url+'/rest/v1/'+table+'?'+query,{headers:{apikey:ctx.connection.key,Authorization:'Bearer '+ctx.connection.accessToken}});
  if(!response.ok)throw Error('Consulta de fechamentos recusada (HTTP '+response.status+'). Confira sessão e instalação no projeto de testes.');
  const page=await response.json();check(ctx);if(!Array.isArray(page))throw Error('Consulta inválida.');if(!page.length)break;
  for(const row of page){if(!row.id||seen.has(row.id))throw Error('Paginação repetida ou identificação inválida.');seen.add(row.id);rows.push(row);}offset+=page.length;
 }
 return rows;
}
// Item rows use a composite key, so their deterministic page order uses agenda_id.
async function claims(ctx){
 const result=new Set();let offset=0;
 for(;;){
  check(ctx);const query=new URLSearchParams({select:'agenda_id',ativo:'eq.true',order:'agenda_id.asc',limit:'100',offset:String(offset)});
  const response=await fetch(ctx.connection.url+'/rest/v1/sc_fechamento_itens?'+query,{headers:{apikey:ctx.connection.key,Authorization:'Bearer '+ctx.connection.accessToken}});
  if(!response.ok)throw Error('Não foi possível conferir os serviços já fechados.');
  const rows=await response.json();check(ctx);if(!Array.isArray(rows))throw Error('Resposta de vínculos inválida.');if(!rows.length)return result;
  for(const row of rows){if(!row.agenda_id||result.has(row.agenda_id))throw Error('Resposta repetida de vínculos.');result.add(row.agenda_id);}offset+=rows.length;
 }
}
async function action(fn){
 if(busy)return;busy=true;const gen=generation;
 for(const id of ['ledgerPrepare','ledgerLoad','ledgerSave','ledgerRetry','ledgerReceiptSave'])$s(id).disabled=true;
 try{await fn();}catch(error){if(gen===generation)$s('ledgerMessage').textContent=error.message;}
 finally{busy=false;for(const id of ['ledgerPrepare','ledgerLoad','ledgerRetry','ledgerReceiptSave'])$s(id).disabled=false;$s('ledgerSave').disabled=!prepared;}
}
function money(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<0)throw Error('Valor inválido na resposta do banco.');return n;}
async function load(ctx){
 check(ctx);listed.clear();$s('ledgerList').innerHTML='';
 const headers=await pages(ctx,'sc_fechamentos',{select:'id,parceiro_nome,unidade,competencia,status,total_centavos,anterior_centavos,criado_em,motivo_cancelamento',unidade:'eq.'+ctx.unit,parceiro_id:'eq.'+ctx.partnerId,competencia:'eq.'+ctx.month+'-01'});
 for(const row of headers){
  const receipts=await pages(ctx,'sc_fechamento_recebimentos',{select:'id,valor_centavos,data_recebimento,forma',fechamento_id:'eq.'+row.id});
  const received=receipts.reduce((sum,r)=>money(sum+money(r.valor_centavos)),0);
  const total=money(row.total_centavos),previous=money(row.anterior_centavos),balance=total-previous-received;
  if(balance<0)throw Error('Saldo inconsistente. Revise o fechamento.');
  listed.set(row.id,{...row,total,previous,received,balance,receipts,ctx});
 }
 check(ctx);$s('ledgerList').innerHTML=headers.length?[...listed.values()].map(row=>`<div class="agenda-card"><b>${escapeHtml(row.parceiro_nome)} · ${escapeHtml(row.unidade)} · ${escapeHtml(row.status)}</b><p class="small">ID: ${escapeHtml(row.id)}</p><p>Cobrado: ${brl(row.total)} · Anterior da agenda: ${brl(row.previous)}<br>Recebimentos do fechamento: ${brl(row.received)} · Saldo: <b>${brl(row.balance)}</b></p>${row.status==='Cancelado'?`<p>Motivo: ${escapeHtml(row.motivo_cancelamento||'')}</p>`:`<button data-ledger-pay="${escapeHtml(row.id)}" ${row.balance===0?'disabled':''}>Registrar recebimento</button><button data-ledger-cancel="${escapeHtml(row.id)}" ${row.receipts.length?'disabled':''}>Cancelar fechamento</button>`}<details><summary>Histórico de recebimentos (${row.receipts.length})</summary>${row.receipts.map(receipt=>`<p>${escapeHtml(receipt.data_recebimento)} · ${escapeHtml(receipt.forma)} · ${brl(money(receipt.valor_centavos))}</p>`).join('')||'<p>Nenhum recebimento neste fechamento.</p>'}</details></div>`).join(''):'<p>Nenhum fechamento salvo para esses filtros.</p>';
 for(const button of document.querySelectorAll('[data-ledger-pay]'))button.onclick=()=>{
  if(busy)return;const row=listed.get(button.dataset.ledgerPay);try{check(row.ctx);}catch(error){$s('ledgerMessage').textContent=error.message;return;}
  $s('ledgerReceiptId').value=row.id;$s('ledgerReceiptAmount').value='';$s('ledgerReceiptDate').value=formatAgendaDate(new Date());$s('ledgerReceiptSummary').textContent='Saldo consultado: '+brl(row.balance);$s('ledgerReceiptForm').classList.remove('hidden');
 };
 for(const button of document.querySelectorAll('[data-ledger-cancel]'))button.onclick=()=>action(async()=>{
  const row=listed.get(button.dataset.ledgerCancel);check(row.ctx);const reason=prompt('Motivo do cancelamento (mínimo 3 caracteres):');if(reason===null)return;
  const intent=api.cancelIntent({id:row.id,reason});if(!confirm('Cancelar este fechamento de testes e liberar seus serviços? O histórico será mantido.'))return;
  await execute(row.ctx,intent);await loadAfterConfirmed(row.ctx);
 });
}
async function loadAfterConfirmed(ctx){
 try{await load(ctx);}catch(error){throw Error('A gravação já foi confirmada. A consulta seguinte falhou: '+error.message);}
}
async function execute(ctx,intent){
 check(ctx);if(!navigator.locks?.request)throw Error('Este navegador não oferece bloqueio entre abas. Use Chrome ou Edge atualizado.');
 const result=await api.executeJournaled({actor:ctx.actor,intent,storage:localStorage,withLock:(key,fn)=>navigator.locks.request(key,async()=>{check(ctx);return fn();}),connection:ctx.connection});
 check(ctx);prepared=null;$s('ledgerSave').disabled=true;$s('ledgerPrepared').innerHTML='';$s('ledgerReceiptForm').classList.add('hidden');
 $s('ledgerMessage').textContent='Operação confirmada no banco de testes. Saldo do fechamento: '+brl(result.balanceCents)+'.';return result;
}
$s('ledgerLoad').onclick=()=>action(async()=>{const ctx=await context();await load(ctx);$s('ledgerMessage').textContent='Histórico consultado no banco de testes. Valores recebidos aqui não são somados novamente aos anteriores da agenda.';});
$s('ledgerPrepare').onclick=()=>action(async()=>{
 prepared=null;$s('ledgerPrepared').innerHTML='';const ctx=await context();
 const next=new Date(ctx.month+'-01T12:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);const end=next.toISOString().slice(0,10);
 const remote=await pages(ctx,'agenda_eventos',{select:'id,cliente,unidade,data,status,revision,sc_escopo_id,valor_servico,gasto_extra,valor_cobrado,valor_recebido,escopo:sc_clientes_escopos!agenda_eventos_escopo_unidade_fk(id,unidade,parceiro_id)',unidade:'eq.'+ctx.unit,data:'gte.'+ctx.month+'-01',and:'(data.lt.'+end+')',status:'eq.Concluído',arquivado_em:'is.null'});
 const active=await claims(ctx);let already=0;
 const local=agendaLocal();const mapped=remote.filter(row=>row.escopo?.parceiro_id===ctx.partnerId).filter(row=>{if(active.has(row.id)){already++;return false}return true;}).map(row=>({id:row.id,cliente:row.cliente,unit:row.unidade,date:row.data,status:row.status,scopeId:row.sc_escopo_id,serviceContext:{unit:row.escopo.unidade,partnerId:row.escopo.parceiro_id},baseRevision:Number(row.revision),syncStatus:local.some(item=>item.id===row.id&&item.syncStatus==='pending')?'pending':'synced',serviceValue:row.valor_servico,extraExpense:row.gasto_extra,valorCobrado:row.valor_cobrado,valorRecebido:row.valor_recebido}));
 const report=buildAgendaPartnerPreview(mapped,ctx.month,ctx.unit,ctx.partnerId);check(ctx);
 if(!report.items.length||report.issues.length)throw Error(report.issues.join('; ')||'Nenhum serviço elegível. Já vinculados a fechamentos ativos: '+already+'.');
 prepared={ctx,items:mapped.map(row=>({id:row.id,revision:row.baseRevision})),report,fingerprint:JSON.stringify(agendaLocal())};
 $s('ledgerPrepared').innerHTML=`<p><b>${report.items.length} serviço(s), cobrado ${brl(report.charged)}, anterior ${brl(report.received)}, saldo ${brl(report.balance)}.</b> Já fechados e excluídos: ${already}.</p><ul>${report.items.map(row=>`<li>${escapeHtml(row.date)} · ${escapeHtml(row.cliente)} · ${brl(row.charged)}</li>`).join('')}</ul><p class="small">Conferido no servidor. Salvar congela os dados financeiros desses serviços. Não envia cobrança ao parceiro.</p>`;
});
$s('ledgerSave').onclick=()=>action(async()=>{
 const current=prepared;if(!current)throw Error('Prepare o fechamento primeiro.');check(current.ctx);
 if(current.fingerprint!==JSON.stringify(agendaLocal()))throw Error('A agenda local mudou. Prepare novamente.');
 if(!confirm('Salvar fechamento de TESTES com '+current.report.items.length+' serviço(s), cobrado '+brl(current.report.charged)+' e saldo '+brl(current.report.balance)+'? Os valores ficarão bloqueados na agenda.'))return;
 const intent=api.createIntent({id:crypto.randomUUID(),partnerId:current.ctx.partnerId,unit:current.ctx.unit,month:current.ctx.month,items:current.items});
 await execute(current.ctx,intent);await loadAfterConfirmed(current.ctx);
});
$s('ledgerReceiptSave').onclick=()=>action(async()=>{
 const ctx=await context(),id=$s('ledgerReceiptId').value,row=listed.get(id);if(!row)throw Error('Consulte o fechamento novamente.');check(row.ctx);
 const raw=$s('ledgerReceiptAmount').value.trim();if(!/^\d+(?:[.,]\d{1,2})?$/.test(raw))throw Error('Informe o valor em reais com até duas casas decimais.');
 const parts=raw.replace(',','.').split('.'),amount=Number(parts[0])*100+Number((parts[1]||'').padEnd(2,'0'));
 const intent=api.receiptIntent({id:crypto.randomUUID(),settlementId:id,amountCents:amount,receivedOn:$s('ledgerReceiptDate').value,method:$s('ledgerReceiptMethod').value});
 if(amount>row.balance)throw Error('O valor ultrapassa o saldo consultado.');
 if(!confirm('Registrar '+brl(amount)+' por '+intent.body.p_forma+' no fechamento de TESTES '+id+'? Este registro não movimenta dinheiro.'))return;
 await execute(ctx,intent);await loadAfterConfirmed(ctx);
});
$s('ledgerRetry').onclick=()=>action(async()=>{
 const ctx=await context(),intent=api.pendingIntent(localStorage,ctx.actor);if(!intent){$s('ledgerMessage').textContent='Nenhuma operação sem confirmação para esta conta.';return;}
 const detail=intent.rpc==='sc_registrar_recebimento'?'Recebimento '+brl(intent.body.p_centavos)+' em '+intent.body.p_data+' por '+intent.body.p_forma+' no fechamento '+intent.body.p_fechamento:intent.rpc==='sc_criar_fechamento'?'Fechamento '+intent.body.p_unidade+' / '+intent.body.p_competencia+' com '+intent.body.p_itens.length+' serviço(s)':'Cancelamento do fechamento '+intent.body.p_id;
 if(!confirm(detail+'. Conferir/reenviar a operação pendente (ID '+intent.body.p_id+')? O mesmo ID será mantido.'))return;
 await execute(ctx,intent);await loadAfterConfirmed(ctx);
});
})();
