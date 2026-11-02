(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SCFieldAgenda=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const STAGING='https://zzphucuiqhzrilrddxnf.supabase.co';
const fields=['id','cliente','telefone','cidade','endereco','maps_url','placas','unidade','data','hora','duracao_min','tecnico','status'];
function date(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Informe datas válidas.');
 const d=new Date(value+'T00:00:00Z');if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==value)throw Error('Informe datas válidas.');return +d;
}
function parameters(input){
 const start=date(input.start),end=date(input.end);
 if(end<start||(end-start)/86400000>92)throw Error('Selecione até 93 dias, em ordem crescente.');
 if(![null,'RS','SC'].includes(input.unit))throw Error('Selecione uma unidade válida.');
 return {p_inicio:input.start,p_fim:input.end,p_unidade:input.unit};
}
async function read({url,headers,fetch:request,check,input}){
 if(url!==STAGING)throw Error('Consulta disponível somente no ambiente de testes.');
 const body=JSON.stringify(parameters(input)),rows=[],seen=new Set();
 if(typeof check!=='function'||typeof request!=='function')throw Error('Contexto de sessão obrigatório.');
 for(let page=0;page<500;page++){
  check();
  const response=await request(url+'/rest/v1/rpc/sc_agenda_campo?order=data.asc,hora.asc,id.asc&limit=500&offset='+rows.length,
   {method:'POST',headers:{...headers,'Content-Type':'application/json'},body});
  check();
  if(!response.ok)throw Error('Consulta recusada (HTTP '+response.status+'). Confira sua sessão e o acesso cadastrado.');
  const batch=await response.json();check();
  if(!Array.isArray(batch))throw Error('Resposta da agenda inválida.');
  if(batch.length===0)return rows;
  for(const row of batch){
   if(!row||typeof row.id!=='string'||!row.id||seen.has(row.id)||!['RS','SC'].includes(row.unidade))throw Error('Resposta da agenda inválida ou repetida.');
   date(row.data);
   if(row.data<input.start||row.data>input.end||(input.unit&&row.unidade!==input.unit))throw Error('Resposta fora do período ou da unidade solicitada.');
   seen.add(row.id);
   // Whitelist even if the server accidentally adds columns in a future version.
   rows.push(Object.fromEntries(fields.map(key=>[key,row[key]??null])));
  }
 }
 throw Error('Consulta extensa demais. Reduza o período.');
}
return {parameters,read};
});
