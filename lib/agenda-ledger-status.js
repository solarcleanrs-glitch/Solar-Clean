/* Read-only ledger projection for agenda cards. Never allocates a group receipt to a service. */
(function(root){
'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function cents(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<0)throw Error('Valor inválido no fechamento');return n;}
function paymentText(header,receipts){
 if(header.status!=='Fechado')return null;
 const total=cents(header.total_centavos),previous=cents(header.anterior_centavos),ids=new Set();let paid=previous;
 if(total===0||previous>total)throw Error('Total inválido');
 for(const row of receipts){if(!row.id||ids.has(row.id))throw Error('Recebimento duplicado');ids.add(row.id);paid=cents(paid+cents(row.valor_centavos));}
 if(paid>total)throw Error('Saldo inconsistente');
 const balance=total-paid;
 if(balance===0)return 'Quitado no fechamento';
 const formatted=(balance/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 return (paid?'Recebimento parcial no fechamento':'Pendente no fechamento')+' · saldo do fechamento: '+formatted;
}
if(typeof module==='object'&&module.exports)module.exports={paymentText};
if(!root?.document)return;
let generation=0,linked=new Set();
const nodes=()=>[...document.querySelectorAll('[data-agenda-payment-id]')];
function clear(){generation++;linked.clear();for(const node of nodes()){node.textContent='Fechamento não consultado';node.removeAttribute('title');}}
function subject(){
 if(!currentTech()?.cloud)throw Error('Sessão necessária');
 let sub;try{sub=JSON.parse(atob((localStorage.getItem('solarCleanAccessToken')||'').split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub;}catch(e){}
 if(!UUID.test(sub||''))throw Error('Sessão inválida');return sub;
}
async function refresh(rows=window.__agendaFiltered||[]){
 linked.clear();
 const gen=++generation,slots=nodes();if(!slots.length)return;
 const byId=new Map(rows.map(row=>[row.id,row]));
 for(const node of slots){node.textContent='Consultando fechamento…';node.removeAttribute('title');}
 const unchanged=actor=>generation===gen&&serviceContextEnabled()&&canSeeAgendaFinance()&&cloudConfig().url==='https://zzphucuiqhzrilrddxnf.supabase.co'&&subject()===actor;
 try{
  if(!serviceContextEnabled()||!canSeeAgendaFinance()||!navigator.onLine||cloudConfig().url!=='https://zzphucuiqhzrilrddxnf.supabase.co')throw Error('Consulta indisponível');
  const actor=subject();await ensureVistoriaSession();if(!unchanged(actor))return;
  const config=cloudConfig(),token=localStorage.getItem('solarCleanAccessToken');
  const get=async(table,params,key)=>{
   const all=[],seen=new Set();let offset=0;
   for(;;){
    if(!unchanged(actor))throw Error('Sessão alterada');
    const query=new URLSearchParams({...params,order:key+'.asc',limit:'100',offset:String(offset)});
    const response=await fetch(config.url+'/rest/v1/'+table+'?'+query,{headers:{apikey:config.key,Authorization:'Bearer '+token}});
    if(!response.ok)throw Error('Consulta recusada');const page=await response.json();if(!unchanged(actor))throw Error('Sessão alterada');
    if(!Array.isArray(page))throw Error('Resposta inválida');if(!page.length)return all;
    for(const item of page){if(!item[key]||seen.has(item[key]))throw Error('Paginação inválida');seen.add(item[key]);all.push(item);}offset+=page.length;
   }
  };
  const active=new Map(),headers=new Map(),ids=[...new Set(slots.map(node=>node.dataset.agendaPaymentId))];
  if(ids.some(id=>!UUID.test(id)))throw Error('Identificador inválido');
  for(let start=0;start<ids.length;start+=40){
   const items=await get('sc_fechamento_itens',{select:'agenda_id,fechamento_id,fechamento:sc_fechamentos!inner(id,status,unidade,parceiro_id,total_centavos,anterior_centavos)',ativo:'eq.true',agenda_id:'in.('+ids.slice(start,start+40).join(',')+')'},'agenda_id');
   for(const item of items){
    const row=byId.get(item.agenda_id),header=item.fechamento;
    if(!row||!header||header.id!==item.fechamento_id||active.has(item.agenda_id)||header.status!=='Fechado'||header.unidade!==row.unit||!row.serviceContext||header.parceiro_id!==row.serviceContext.partnerId)throw Error('Vínculo divergente');
    active.set(item.agenda_id,header.id);headers.set(header.id,header);
   }
  }
  const labels=new Map();
  for(const [id,header] of headers){
   const receipts=await get('sc_fechamento_recebimentos',{select:'id,valor_centavos',fechamento_id:'eq.'+id},'id');labels.set(id,paymentText(header,receipts));
  }
  if(!unchanged(actor))return;
  linked=new Set(active.keys());
  if(linked.has(window.__agendaFinanceEventId)){
   document.getElementById?.('agendaFinanceEditor')?.classList.add('hidden');window.__agendaFinanceEventId='';
  }
  for(const node of slots){
   const id=active.get(node.dataset.agendaPaymentId);
   node.textContent=id?labels.get(id):(node.dataset.agendaPaymentBase||'Pagamento não informado');
   if(id)node.title='Situação do fechamento '+id+'. Recebimentos pertencem ao conjunto de serviços do fechamento.';
  }
 }catch(error){
  if(gen===generation)for(const node of slots){node.textContent='Fechamento não consultado — atualize com conexão';node.removeAttribute('title');}
 }
}
root.AgendaLedgerStatus={refresh,clear,isLinked:id=>linked.has(id)};
})(typeof window==='undefined'?null:window);
