(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SCClientHistoryImportAPI=factory();})(typeof window==='undefined'?this:window,function(){
'use strict';
const PROJECT='https://zzphucuiqhzrilrddxnf.supabase.co',UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function run({request,context,storage,fetcher,withLock}){
 const initial=context();if(initial.url!==PROJECT||!UUID.test(initial.actor||''))throw Error('Use a conta conectada ao projeto de testes.');
 if(request?.rpc!=='sc_importar_cliente_google'||!UUID.test(request.params?.p_cliente_id||'')||request.params.p_revisado!==true)throw Error('Plano de importação inválido.');
 const p=request.params;
 const key='solarCleanClientImport:v1:zzphucuiqhzrilrddxnf:'+initial.actor.toLowerCase()+':'+encodeURIComponent(p.p_agenda)+':'+encodeURIComponent(p.p_evento);
 if(typeof withLock!=='function')throw Error('Este navegador precisa de suporte a bloqueio entre abas.');
 const same=()=>{const now=context();if(now.url!==initial.url||now.actor!==initial.actor)throw Error('Conta ou projeto mudou. A operação permanece na conta original.');return now;};
 return withLock(key,async()=>{
  same();let state;const raw=storage.getItem(key);
  if(raw){try{state=JSON.parse(raw);}catch(e){throw Error('Operação anterior ilegível; preserve o armazenamento.');}
   if(state.actor!==initial.actor||state.project!==PROJECT||state.key!==key||!state.request)throw Error('Operação anterior incompatível.');
   // Reuse the originally committed intent ID even after a reload/new preview.
   const old=state.request.params;
   if((request.targetMode==='existing'||state.request.targetMode==='existing')&&p.p_cliente_id!==old.p_cliente_id)throw Error('A operação anterior aponta para outro cliente. Preserve o destino original para conferir novamente.');
   const comparable=x=>JSON.stringify({agenda:x.p_agenda,evento:x.p_evento,cadastro:x.p_cadastro,original:x.p_original,revisado:x.p_revisado});
   if(comparable(old)!==comparable(p))throw Error('Existe uma operação anterior com outros dados. Confira antes de alterar.');
   if(state.phase==='confirmed')return state.result;
   if(state.phase!=='pending')throw Error('Estado anterior inválido.');
  }else{
   state={key,actor:initial.actor,project:PROJECT,phase:'pending',request:JSON.parse(JSON.stringify(request))};
   const text=JSON.stringify(state);storage.setItem(key,text);if(storage.getItem(key)!==text)throw Error('Não foi possível preservar a operação antes do envio.');
  }
  const current=same();let response;
  try{response=await fetcher(PROJECT+'/rest/v1/rpc/sc_importar_cliente_google',{method:'POST',headers:current.headers,body:JSON.stringify(state.request.params)});}catch(e){throw Error('Resposta não confirmada. Use os mesmos dados para conferir novamente.');}
  same();let result;try{result=await response.json();}catch(e){throw Error('Resposta ilegível. A operação foi preservada para conferência.');}same();
  if(!response.ok)throw Error('Importação não confirmada ('+response.status+'). '+String(result?.message||'Confira acesso e instalação da estrutura.').slice(0,200));
  if(result?.cliente_id!==state.request.params.p_cliente_id||!Number.isInteger(result.revision)||result.revision<1||typeof result.repetido!=='boolean')throw Error('Confirmação incompatível. A operação foi preservada.');
  state={...state,phase:'confirmed',result};const text=JSON.stringify(state);storage.setItem(key,text);
  if(storage.getItem(key)!==text)throw Error('Servidor respondeu, mas a confirmação local não foi preservada. Confira novamente com os mesmos dados.');
  return result;
 });
}
return {run};
});
