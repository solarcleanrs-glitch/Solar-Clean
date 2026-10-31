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
return {identity,record,read};
});
