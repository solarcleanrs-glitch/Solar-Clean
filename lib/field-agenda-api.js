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
const reportFields=['client_uuid','created_at','updated_at','cliente','telefone','cidade','endereco','placas','pot_placa','marca_placa','marca_inv','modelo_inv','ano_inst','telhado','sujeira','sujidades','estrutura','dps','qtd_dps','modelo_dps','inv_status','inv_internet','erro_inv','show_generation','antes','depois','pct','limpeza','retorno','tecnico'];
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
function context(ctx){if(ctx.url!==STAGING||typeof ctx.check!=='function'||typeof ctx.fetch!=='function')throw Error('Contexto de testes inválido.');ctx.check();}
async function rpc(ctx,name,body,query=''){
 context(ctx);const response=await ctx.fetch(ctx.url+'/rest/v1/rpc/'+name+query,{method:'POST',headers:{...ctx.headers,'Content-Type':'application/json'},body:JSON.stringify(body)});
 ctx.check();if(!response.ok)throw Error('Consulta recusada (HTTP '+response.status+').');
 const data=await response.json();ctx.check();return data;
}
async function reports(ctx){
 const body=parameters(ctx.input),rows=[],seen=new Set();
 for(let i=0;i<500;i++){
  const batch=await rpc(ctx,'sc_relatorios_campo',body,'?order=created_at.asc,client_uuid.asc&limit=500&offset='+rows.length);
  if(!Array.isArray(batch))throw Error('Lista de relatórios inválida.');if(!batch.length)return rows;
  for(const row of batch){
   if(!row||!uuid(row.client_uuid)||seen.has(row.client_uuid)||typeof row.created_at!=='string'||!Number.isFinite(Date.parse(row.created_at))||![null,'RS','SC'].includes(row.unidade))throw Error('Lista de relatórios inválida ou repetida.');
   if(ctx.input.unit&&row.unidade!==ctx.input.unit)throw Error('Relatório fora da unidade solicitada.');
   seen.add(row.client_uuid);rows.push({client_uuid:row.client_uuid,cliente:String(row.cliente||''),created_at:row.created_at,unidade:row.unidade});
  }
 }
 throw Error('Reduza o período de consulta.');
}
function photoAllowed(photo,owner){return photo&&['Antes','Depois','Telhado','DPS','Inversor','Problema','Foto'].includes(photo.category)&&['image/jpeg','image/png','image/webp'].includes(photo.type)&&typeof photo.storagePath==='string'&&photo.storagePath.startsWith(owner+'/')&&!photo.storagePath.includes('..');}
async function report(ctx,owner){
 if(!uuid(owner))throw Error('Selecione um relatório válido.');
 const data=await rpc(ctx,'sc_relatorio_campo',{p_vistoria:owner});
 if(!data)throw Error('Relatório indisponível para esta conta.');
 if(data.client_uuid!==owner)throw Error('Identificação do relatório divergente.');
 const result=Object.fromEntries(reportFields.map(key=>[key,data[key]??null]));
 if(!Array.isArray(data.media_manifest))throw Error('Manifesto de fotos inválido.');
 result.media_manifest=data.media_manifest.filter(p=>photoAllowed(p,owner)).map(p=>({category:p.category,type:p.type,storagePath:p.storagePath}));
 return result;
}
async function photo(ctx,owner,item){
 context(ctx);if(!uuid(owner)||!photoAllowed(item,owner))throw Error('Foto fora do relatório autorizado.');
 const response=await ctx.fetch(ctx.url+'/storage/v1/object/vistoria-media/'+item.storagePath.split('/').map(encodeURIComponent).join('/'),{headers:ctx.headers});
 ctx.check();if(!response.ok)throw Error('Foto não disponível (HTTP '+response.status+').');
 const blob=await response.blob();ctx.check();
 if(!['image/jpeg','image/png','image/webp'].includes(blob.type)||blob.size>10*1024*1024)throw Error('Formato ou tamanho de foto não suportado.');
 return blob;
}
async function clients(ctx){
 const unit=ctx.input.unit,search=ctx.input.search??'';
 if(![null,'RS','SC'].includes(unit)||typeof search!=='string'||search.length>100)throw Error('Unidade ou pesquisa inválida.');
 const rows=[],seen=new Set();
 for(let i=0;i<500;i++){
  const batch=await rpc(ctx,'sc_clientes_campo',{p_unidade:unit,p_busca:search},'?order=cliente.asc,id.asc&limit=500&offset='+rows.length);
  if(!Array.isArray(batch))throw Error('Lista de clientes inválida.');if(!batch.length)return rows;
  for(const row of batch){
   if(!row||!uuid(row.id)||seen.has(row.id)||typeof row.cliente!=='string'||!['RS','SC'].includes(row.unidade)||!['particular','parceiro','nao_informada'].includes(row.origem)||(unit&&row.unidade!==unit))throw Error('Cadastro inválido ou fora da unidade solicitada.');
   seen.add(row.id);rows.push(Object.fromEntries(['id','cliente','telefone','cidade','endereco','unidade','origem'].map(key=>[key,row[key]??''])));
  }
 }
 throw Error('Refine a pesquisa de clientes.');
}
const outcomes=['Tentativa sem resposta','Cliente respondeu','Orçamento solicitado','Agendamento combinado','Retornar mais tarde','Não deseja contato'];
function contactIntent(input,id){
 if(!uuid(id)||!uuid(input.client)||!outcomes.includes(input.outcome)||typeof input.note!=='string'||input.note.length>2000)throw Error('Dados do contato inválidos.');
 const followup=input.followup;
 if(followup!==undefined&&followup!==null&&followup!=='')date(followup);
 return Object.freeze({p_id:id,p_cliente:input.client,p_resultado:input.outcome,p_observacao:input.note,p_retorno:followup===''?null:followup??null});
}
async function canContact(ctx){const allowed=await rpc(ctx,'sc_pode_registrar_contato_cliente',{});if(typeof allowed!=='boolean')throw Error('Permissão de contato inválida.');return allowed;}
async function contacts(ctx,client){
 if(!uuid(client))throw Error('Cliente inválido.');const rows=[],seen=new Set();
 for(let i=0;i<500;i++){
  const batch=await rpc(ctx,'sc_historico_contatos_cliente',{p_cliente:client},'?order=created_at.desc,id.asc&limit=500&offset='+rows.length);
  if(!Array.isArray(batch))throw Error('Histórico inválido.');if(!batch.length)return rows;
  for(const row of batch){if(!row||!uuid(row.id)||seen.has(row.id)||!outcomes.includes(row.resultado)||typeof row.observacao!=='string'||!Number.isFinite(Date.parse(row.created_at)))throw Error('Contato inválido ou repetido.');
   if(row.retorno!==null)date(row.retorno);seen.add(row.id);rows.push({id:row.id,created_at:row.created_at,resultado:row.resultado,observacao:row.observacao,retorno:row.retorno});
  }
 }throw Error('Histórico extenso demais.');
}
async function recordContact(ctx,intent){
 const checked=contactIntent({client:intent.p_cliente,outcome:intent.p_resultado,note:intent.p_observacao,followup:intent.p_retorno},intent.p_id);
 const result=await rpc(ctx,'sc_registrar_contato_cliente',checked);
 if(!result||result.id!==checked.p_id||typeof result.repetido!=='boolean')throw Error('Confirmação do contato inválida. Consulte o histórico antes de criar outro.');return result;
}

const clientStatuses=['Em conferência','Ativo','Recorrência pendente','Recuperação','Inativo','Não contatar'];
const editKeys=['cliente','telefone','cidade','endereco','status_comercial'];
function editData(data){
 if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).length!==editKeys.length
 ||Object.keys(data).some(k=>!editKeys.includes(k))||editKeys.some(k=>typeof data[k]!=='string')
 ||!data.cliente.trim()||data.cliente.trim().length>200||data.cidade.length>200||data.endereco.length>1000
 ||(data.telefone!==''&&!/^[+]55[0-9]{10,11}$/.test(data.telefone))||!clientStatuses.includes(data.status_comercial))throw Error('Cadastro inválido.');
 return Object.freeze(Object.fromEntries(editKeys.map(k=>[k,data[k]])));
}
function editSnapshot(data,client){
 if(!data||data.id!==client||!Number.isSafeInteger(data.revision)||data.revision<1)throw Error('Revisão do cadastro inválida.');
 return Object.freeze({id:client,revision:data.revision,...editData(Object.fromEntries(editKeys.map(k=>[k,data[k]])))});
}
async function clientEdit(ctx,client){if(!uuid(client))throw Error('Cliente inválido.');return editSnapshot(await rpc(ctx,'sc_cliente_edicao',{p_cliente:client}),client);}
function editIntent(client,revision,data,id){
 if(!uuid(id)||!uuid(client)||!Number.isSafeInteger(revision)||revision<1||revision>=2147483647)throw Error('Tentativa de edição inválida.');
 return Object.freeze({p_id:id,p_cliente:client,p_revision:revision,p_dados:editData(data)});
}
async function saveClientEdit(ctx,intent){
 const body=editIntent(intent.p_cliente,intent.p_revision,intent.p_dados,intent.p_id);
 const data=await rpc(ctx,'sc_editar_cliente',body);
 if(!data||data.id!==body.p_id||data.cliente_id!==body.p_cliente||data.revision!==body.p_revision+1||typeof data.repetido!=='boolean')throw Error('Confirmação da edição inválida. Consulte o cadastro novamente.');
 return data;
}
async function clientEdits(ctx,client){
 if(!uuid(client))throw Error('Cliente inválido.');const rows=[],seen=new Set();
 for(let page=0;page<500;page++){
  const batch=await rpc(ctx,'sc_historico_edicoes_cliente',{p_cliente:client},'?order=created_at.desc,id.asc&limit=500&offset='+rows.length);
  if(!Array.isArray(batch))throw Error('Histórico de edição inválido.');if(!batch.length)return rows;
  for(const row of batch){
   if(!row||!uuid(row.id)||seen.has(row.id)||typeof row.created_at!=='string'||!Number.isFinite(Date.parse(row.created_at)))throw Error('Histórico de edição inválido.');
   const before=editSnapshot(row.antes,client),after=editSnapshot(row.depois,client);
   if(after.revision!==before.revision+1)throw Error('Revisões do histórico divergentes.');
   seen.add(row.id);rows.push({id:row.id,created_at:row.created_at,antes:before,depois:after});
  }
 }throw Error('Histórico extenso demais.');
}

const nextStatuses={'Agendado':'Em deslocamento','Em deslocamento':'Em atendimento','Em atendimento':'Concluído'};
function agendaID(value){if(typeof value!=='string'||!value.trim()||value.length>512)throw Error('Atendimento inválido.');return value;}
function statusSnapshot(data,id){
 if(!data||data.id!==id||!Number.isSafeInteger(data.revision)||data.revision<1||typeof data.status!=='string'
    ||data.proximo_status!==(nextStatuses[data.status]||null))throw Error('Situação do atendimento inválida. Consulte novamente.');
 return Object.freeze({id,revision:data.revision,status:data.status,proximo_status:data.proximo_status});
}
async function canAdvanceStatus(ctx){const allowed=await rpc(ctx,'sc_pode_avancar_status_campo',{});if(typeof allowed!=='boolean')throw Error('Permissão de atendimento inválida.');return allowed;}
async function agendaStatus(ctx,id){agendaID(id);return statusSnapshot(await rpc(ctx,'sc_agenda_status_campo',{p_agendamento:id}),id);}
function statusIntent(id,revision,status,attempt){
 agendaID(id);
 if(!uuid(attempt)||!Number.isSafeInteger(revision)||revision<1||revision>=Number.MAX_SAFE_INTEGER||!Object.values(nextStatuses).includes(status))throw Error('Confirmação de atendimento inválida.');
 return Object.freeze({p_id:attempt,p_agendamento:id,p_revision:revision,p_status:status});
}
async function advanceStatus(ctx,intent){
 const body=statusIntent(intent.p_agendamento,intent.p_revision,intent.p_status,intent.p_id);
 const result=await rpc(ctx,'sc_avancar_status_campo',body);
 if(!result||result.id!==body.p_id||result.agendamento_id!==body.p_agendamento||result.revision!==body.p_revision+1
    ||result.status!==body.p_status||typeof result.repetido!=='boolean')throw Error('Avanço sem confirmação válida. Consulte a situação antes de uma nova ação.');
 const current=statusSnapshot(result.estado_atual,body.p_agendamento);
 if(current.revision<result.revision)throw Error('Situação atual divergente. Consulte novamente.');
 return Object.freeze({id:result.id,agendamento_id:result.agendamento_id,revision:result.revision,status:result.status,repetido:result.repetido,estado_atual:current});
}

return {parameters,read,reports,report,photo,clients,canContact,contacts,contactIntent,recordContact,outcomes,clientEdit,editIntent,saveClientEdit,clientEdits,clientStatuses,canAdvanceStatus,agendaStatus,statusIntent,advanceStatus};
});
