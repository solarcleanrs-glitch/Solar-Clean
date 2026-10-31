(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SCImportedClientsCRM=factory();})(typeof window==='undefined'?this:window,function(){
'use strict';
const PROJECT='https://zzphucuiqhzrilrddxnf.supabase.co',UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function identity(ctx){return ctx?.url===PROJECT&&UUID.test(ctx.actor||'')?ctx.url+'|'+ctx.actor.toLowerCase():null;}
function record(row){
 if(!row||!UUID.test(row.id||'')||typeof row.cliente!=='string'||!row.cliente.trim()||!['RS','SC'].includes(row.unidade)||!['particular','parceiro','nao_informada'].includes(row.origem))throw Error('Cadastro importado incompatível.');
 return {__crmKey:'sc_cliente:'+row.id.toLowerCase(),__standaloneClient:true,__cloudContactOnly:true,__importedClient:true,
  importedClientId:row.id,cliente:row.cliente,telefone:row.telefone||'',cidade:row.cidade||'',endereco:row.endereco||'',
  unidade:row.unidade,origem:row.origem,parceiroId:row.parceiro_id||null,
  createdAt:'',dateLabel:'Sem vistoria vinculada',retorno:'',obs:'',syncStatus:'synced'};
}
async function read({context,ensureSession,fetcher,pageSize=500}){
 if(!Number.isInteger(pageSize)||pageSize<1||pageSize>500)throw Error('Paginação inválida.');
 const expected=identity(context());if(!expected)return [];
 await ensureSession();const initial=context(),scope=identity(initial);if(!scope||scope!==expected)throw Error('Sessão mudou.');
 const check=()=>{if(identity(context())!==scope)throw Error('Conta ou projeto mudou durante a leitura dos clientes.');};
 const rows=[],ids=new Set();
 for(let offset=0;;offset+=pageSize){
  check();const response=await fetcher(PROJECT+'/rest/v1/sc_clientes?select=id,cliente,telefone,cidade,endereco,unidade,origem,parceiro_id&order=id.asc&limit='+pageSize+'&offset='+offset,{headers:initial.headers});check();
  if(!response.ok)throw Error('Cadastros importados indisponíveis ('+response.status+').');
  const page=await response.json();check();if(!Array.isArray(page))throw Error('Lista de clientes incompatível.');
  for(const row of page){const converted=record(row);if(ids.has(converted.__crmKey))throw Error('Lista de clientes mudou durante a leitura. Atualize novamente.');ids.add(converted.__crmKey);rows.push(converted);}
  if(page.length<pageSize)break;
 }
 return rows;
}
async function readOrigins({clientId,context,ensureSession,fetcher,pageSize=500}){
 if(!UUID.test(clientId||''))throw Error('Cliente inválido.');
 if(!Number.isInteger(pageSize)||pageSize<1||pageSize>500)throw Error('Paginação inválida.');
 const expected=identity(context());if(!expected)throw Error('Entre na conta do projeto de testes.');
 await ensureSession();const initial=context();if(identity(initial)!==expected)throw Error('Sessão mudou.');
 const check=()=>{if(identity(context())!==expected)throw Error('Conta ou projeto mudou durante a leitura.');};
 const result=[],seen=new Set();
 for(let offset=0;;offset+=pageSize){check();
  const response=await fetcher(PROJECT+'/rest/v1/sc_cliente_origens_google?cliente_id=eq.'+encodeURIComponent(clientId)+'&select=agenda_google,evento_google,evento_original,confirmado_em&order=agenda_google.asc,evento_google.asc&limit='+pageSize+'&offset='+offset,{headers:initial.headers});check();
  if(!response.ok)throw Error('Histórico de origem indisponível ('+response.status+').');
  const page=await response.json();check();if(!Array.isArray(page))throw Error('Histórico inválido.');
  for(const row of page){if(typeof row.agenda_google!=='string'||typeof row.evento_google!=='string'||!row.evento_original||row.evento_original.id!==row.evento_google)throw Error('Evento de origem incompatível.');
   const key=JSON.stringify([row.agenda_google,row.evento_google]);if(seen.has(key))throw Error('Histórico mudou durante a leitura. Atualize novamente.');seen.add(key);result.push(row);
  }if(page.length<pageSize)break;
 }return result;
}
return {identity,record,read,readOrigins};
});
