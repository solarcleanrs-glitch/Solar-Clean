(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SCDraftSaveLock=factory();})(typeof window==='undefined'?this:window,function(){
'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function run({locks,actor,draftId,check,operation}){
  if(!UUID.test(actor||'')||!UUID.test(draftId||''))throw Error('Conta ou rascunho inválido.');
  if(!locks||typeof locks.request!=='function')throw Error('Este navegador não permite coordenar o salvamento entre abas. Preserve a cópia e use um navegador compatível.');
  check();
  return locks.request(`solarCleanDraftSave:v1:${actor.toLowerCase()}:${draftId.toLowerCase()}`,{mode:'exclusive'},async()=>{
    check();const result=await operation();check();return result;
  });
}
return {run};
});
