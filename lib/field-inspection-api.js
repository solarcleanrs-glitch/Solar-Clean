(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SCFieldInspection=factory();})(typeof window==='undefined'?this:window,function(){
'use strict';
const PROJECT='https://zzphucuiqhzrilrddxnf.supabase.co',UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const fields=['cliente','telefone','cidade','endereco','placas','pot_placa','marca_placa','marca_inv','modelo_inv','ano_inst','telhado','sujeira','sujidades','estrutura','dps','qtd_dps','modelo_dps','inv_status','inv_internet','erro_inv','show_generation','antes','depois','pct','limpeza','retorno','tecnico','client_signature','signature_at','tech_signature'];
const categories=['Antes','Depois','Telhado','DPS','Inversor','Problema','Foto'];
function photo(p,visit){if(!p||!categories.includes(p.category)||!['image/jpeg','image/png','image/webp'].includes(p.type)||typeof p.storagePath!=='string'||!p.storagePath.startsWith(visit+'/')||p.storagePath.includes('..'))throw Error('Foto fora da vistoria autorizada.');return {name:String(p.name||''),type:p.type,category:p.category,storagePath:p.storagePath};}
function intent({operation,visit,agenda=null,revision,data,photos=[]}){
 if(!UUID.test(operation||'')||!UUID.test(visit||'')||!Number.isSafeInteger(revision)||revision<0||revision>=Number.MAX_SAFE_INTEGER||(revision===0&&(typeof agenda!=='string'||!agenda))||(revision>0&&agenda!==null)||!data||Array.isArray(data)||typeof data!=='object'||Object.keys(data).some(k=>!fields.includes(k)))throw Error('Tentativa técnica inválida ou com campo restrito.');
 for(const[k,v]of Object.entries(data)){
  if(['placas','pot_placa','antes','depois','pct'].includes(k)){if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v>1e9||v<(k==='pct'?-100:0)||k==='placas'&&!Number.isInteger(v)))throw Error('Valor numérico inválido: '+k);}
  else if(k==='show_generation'){if(typeof v!=='boolean')throw Error('Opção de geração inválida.');}
  else if(k==='sujidades'){if(!Array.isArray(v)||v.length>30||v.some(x=>typeof x!=='string'||x.length>80))throw Error('Sujidades inválidas.');}
  else if(['client_signature','tech_signature'].includes(k)){if(v!==null&&(typeof v!=='string'||v.length>250000||v&&!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v)))throw Error('Assinatura inválida.');}
  else if(v!==null&&(typeof v!=='string'||v.length>2000))throw Error('Texto inválido: '+k);
 }
 if(!Array.isArray(photos)||photos.length>30||new Set(photos.map(p=>p.storagePath)).size!==photos.length)throw Error('Use até 30 fotos distintas.');
 const result={p_operacao:operation,p_vistoria:visit,p_agendamento:agenda,p_revision:revision,p_dados:structuredClone(data),p_fotos:photos.map(p=>photo(p,visit))};return Object.freeze(result);
}
function check(ctx){if(ctx.url!==PROJECT||typeof ctx.fetch!=='function'||typeof ctx.check!=='function')throw Error('Use o contexto do projeto de testes.');ctx.check();}
async function rpc(ctx,name,body){check(ctx);const r=await ctx.fetch(PROJECT+'/rest/v1/rpc/'+name,{method:'POST',headers:{...ctx.headers,'Content-Type':'application/json'},body:JSON.stringify(body)});ctx.check();const data=await r.json();ctx.check();if(!r.ok)throw Error('Vistoria não confirmada (HTTP '+r.status+'). '+String(data?.message||'Confira a sessão e a revisão.').slice(0,200));return data;}
function editor(data,visit){
 if(!data||data.vistoria_id!==visit||!UUID.test(data.scope_id||'')||!Number.isSafeInteger(Number(data.revision))||Number(data.revision)<1||!data.data||typeof data.data!=='object'||Array.isArray(data.data)||!Array.isArray(data.photos)||!Number.isFinite(Date.parse(data.created_at))||!Number.isFinite(Date.parse(data.updated_at)))throw Error('Vistoria técnica sem confirmação válida.');
 for(const key of ['client_signature','tech_signature'])if(data.data[key]&&!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data.data[key]))throw Error('Assinatura antiga exige conferência do gestor.');
 return {vistoria_id:visit,scope_id:data.scope_id,revision:Number(data.revision),created_at:data.created_at,updated_at:data.updated_at,data:Object.fromEntries(fields.filter(k=>Object.hasOwn(data.data,k)).map(k=>[k,data.data[k]])),photos:data.photos.map(p=>photo(p,visit))};
}
async function read(ctx,visit){if(!UUID.test(visit||''))throw Error('Vistoria inválida.');return editor(await rpc(ctx,'sc_vistoria_campo_edicao',{p_vistoria:visit}),visit);}
async function association(ctx,agenda){if(typeof agenda!=='string'||!agenda)throw Error('Agendamento inválido.');const r=await rpc(ctx,'sc_vistoria_agendamento_campo',{p_agendamento:agenda});if(r===null)return null;if(!UUID.test(r?.vistoria_id||'')||typeof r.confirmed!=='boolean'||typeof r.own!=='boolean')throw Error('Vínculo de vistoria inválido.');return {vistoria_id:r.vistoria_id,confirmed:r.confirmed,own:r.own};}
async function abandon(ctx,operation){if(!UUID.test(operation||''))throw Error('Tentativa inválida.');const r=await rpc(ctx,'sc_abandonar_vistoria_campo',{p_operacao:operation});if(r?.operacao_id!==operation||typeof r.confirmed!=='boolean'||typeof r.cancelled!=='boolean'||r.confirmed===r.cancelled)throw Error('Abandono não confirmado. Preserve a pendência.');return r;}
async function prepare(ctx,body){body=intent({operation:body.p_operacao,visit:body.p_vistoria,agenda:body.p_agendamento,revision:body.p_revision,data:body.p_dados,photos:body.p_fotos});const r=await rpc(ctx,'sc_preparar_vistoria_campo',body);if(r?.operacao_id!==body.p_operacao||r.vistoria_id!==body.p_vistoria||typeof r.confirmed!=='boolean')throw Error('Reserva da vistoria não confirmada.');return r;}
async function confirm(ctx,body){const r=await rpc(ctx,'sc_confirmar_vistoria_campo',{p_operacao:body.p_operacao});if(r?.operacao_id!==body.p_operacao||r.vistoria_id!==body.p_vistoria||Number(r.revision)!==body.p_revision+1||typeof r.repetido!=='boolean')throw Error('Gravação técnica sem confirmação válida.');const current=editor(r.estado_atual,body.p_vistoria);if(current.revision<Number(r.revision))throw Error('Revisão atual divergente.');return {...r,estado_atual:current};}
function bytes(p){const match=typeof p.data==='string'&&p.data.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);if(!match||match[1]!==p.type)throw Error('Preserve a foto local; conteúdo inválido.');const raw=atob(match[2]),b=Uint8Array.from(raw,c=>c.charCodeAt(0));if(!b.length||b.length>5242880)throw Error('Foto fora do limite de 5 MB.');return b;}
async function upload(ctx,body,p){check(ctx);photo(p,body.p_vistoria);if(!p.storagePath.startsWith(body.p_vistoria+'/campo/'+body.p_operacao+'/'))return;
 const content=bytes(p),url=PROJECT+'/storage/v1/object/vistoria-media/'+p.storagePath.split('/').map(encodeURIComponent).join('/');let response,uncertain=false;
 try{response=await ctx.fetch(url,{method:'POST',headers:{...ctx.headers,'Content-Type':p.type,'x-upsert':'false'},body:content});ctx.check();}catch(error){ctx.check();uncertain=true;}
 if(!uncertain&&response.ok)return;
 if(!uncertain&&response.status!==409)throw Error('Foto não confirmada (HTTP '+response.status+'). Preserve a pendência.');
 const recovered=await ctx.fetch(url,{headers:ctx.headers});ctx.check();if(!recovered.ok)throw Error('Foto sem confirmação; reenvie a mesma tentativa.');const actual=new Uint8Array(await recovered.arrayBuffer());ctx.check();
 if(actual.length!==content.length||actual.some((b,i)=>b!==content[i]))throw Error('Arquivo existente com conteúdo diferente. Nenhuma foto foi substituída.');
}
async function send(ctx,body,photos){const result=await prepare(ctx,body);if(!result.confirmed)for(const p of photos)await upload(ctx,body,p);return confirm(ctx,body);}
return {fields,categories,intent,editor,read,association,abandon,prepare,confirm,upload,send,photoBytes:bytes};
});
