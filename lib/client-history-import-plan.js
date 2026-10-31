(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SCClientHistoryImportPlan=factory();})(typeof window==='undefined'?this:window,function(){
'use strict';
// Build explicit, reviewed RPC inputs; this module performs no I/O or import.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function plan(candidate,review){
 if(!candidate||!Array.isArray(candidate.events)||!candidate.events.length)throw Error('Candidato sem eventos.');
 if(!review||review.confirmed!==true||!UUID.test(review.clientId||''))throw Error('Confirmação e ID estável obrigatórios.');
 if(typeof review.calendarId!=='string'||!review.calendarId.trim())throw Error('Agenda de origem obrigatória.');
 const c=review.fields;
 if(!c||Object.keys(c).some(k=>!['cliente','telefone','cidade','endereco','unidade','origem','parceiro_id'].includes(k)))throw Error('Cadastro inválido.');
 for(const k of ['cliente','telefone','cidade','endereco','unidade','origem'])if(typeof c[k]!=='string')throw Error('Confirme todos os campos, inclusive os vazios.');
 if(!c.cliente.trim()||c.cliente.trim().length>200||c.cidade.length>200||c.endereco.length>1000)throw Error('Nome ou endereço inválido.');
 if(c.telefone&&!/^\+55\d{10,11}$/.test(c.telefone))throw Error('Telefone deve ser conferido no formato internacional.');
 if(!['RS','SC'].includes(c.unidade)||!['particular','parceiro','nao_informada'].includes(c.origem))throw Error('Confirme unidade e origem.');
 if(c.origem==='parceiro'?!UUID.test(c.parceiro_id||''):c.parceiro_id!==null)throw Error('Parceiro incompatível.');
 const fields={...c,cliente:c.cliente.trim()},ids=new Set();
 return candidate.events.map(event=>{
  if(typeof event.id!=='string'||!event.id||event.status!=='confirmed'||event.sourceKey!==review.calendarId+':'+event.id||ids.has(event.id))throw Error('Evento repetido ou origem incompatível.');
  ids.add(event.id);
  const original={...event};delete original.sourceKey;
  // IDs must be retained with the approved plan for exact retries, never regenerated.
  return {rpc:'sc_importar_cliente_google',params:{p_cliente_id:review.clientId,p_agenda:review.calendarId,p_evento:event.id,p_cadastro:{...fields},p_original:original,p_revisado:true}};
 });
}
return {plan};
});
