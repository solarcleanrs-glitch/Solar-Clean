/* Read-only, global-manager review. Never imports or sends legacy records. */
(()=>{'use strict';
if(location.hostname!=='solar-clean-testes-crm.pages.dev'&&!location.hostname.endsWith('.solar-clean-testes-crm.pages.dev'))return;
const panel=document.getElementById('scopedMigrationPanel');if(!panel||!window.SCLegacyLocalReview)return;
panel.classList.remove('hidden');panel.innerHTML='<h3>Dados antigos deste aparelho</h3><p>Os dados anteriores continuam preservados. Somente o gestor global pode conferir e baixar uma cópia para revisão. A cópia não importa nem sincroniza registros e não atribui sua propriedade à conta atual.</p><button id="legacyLocalInspect" type="button">Conferir dados antigos</button><button id="legacyLocalExport" type="button" disabled>Baixar cópia para revisão</button><p id="legacyLocalStatus" role="status"></p>';
const el=id=>document.getElementById(id);let generation=0,prepared=null;
function clear(){generation++;prepared=null;el('legacyLocalInspect').disabled=false;el('legacyLocalExport').disabled=true;el('legacyLocalStatus').textContent='';}
function context(){return {...appDraftContext(),generation:authSessionGeneration,url:cloudConfig().url};}
async function authorize(){
 if(!navigator.onLine||cloudConfig().url!=='https://zzphucuiqhzrilrddxnf.supabase.co')throw Error('Entre na nuvem e conecte à internet no projeto de testes.');
 const guard=captureVistoriaOperationGuard();await ensureVistoriaSession();guard();
 const response=await fetch(cloudConfig().url+'/rest/v1/rpc/sc_is_manager',{method:'POST',headers:crmHistoryCloudHeaders(),body:'{}'});guard();
 if(!response.ok)throw Error('Não foi possível conferir o acesso de gestor.');const result=await response.json();guard();return result===true;
}
el('legacyLocalInspect').onclick=async()=>{clear();const gen=generation;el('legacyLocalInspect').disabled=true;el('legacyLocalStatus').textContent='Conferindo acesso e dados antigos…';
 try{const result=await SCLegacyLocalReview.prepare({context,authorize,storage:localStorage,readRecords:()=>SCLegacyLocalReview.readLegacy(indexedDB)});if(gen!==generation)return;prepared=result;el('legacyLocalExport').disabled=false;el('legacyLocalStatus').textContent=result.count+' vistoria(s) antiga(s), '+result.pending+' pendente(s). Confira a propriedade antes de qualquer importação. Nenhum registro foi copiado para a conta atual.';}
 catch(e){if(gen===generation)el('legacyLocalStatus').textContent=e.message;}finally{if(gen===generation)el('legacyLocalInspect').disabled=false;}
};
el('legacyLocalExport').onclick=async()=>{if(!prepared)return;const item=prepared,gen=generation;el('legacyLocalExport').disabled=true;let url;
 try{await item.verify();if(gen!==generation)return;item.check();url=URL.createObjectURL(new Blob([item.text],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='solar-clean-legado-para-revisao.json';link.click();el('legacyLocalStatus').textContent='Cópia preparada para download. Os originais continuam preservados, sem importação ou sincronização.';}
 catch(e){if(gen===generation)el('legacyLocalStatus').textContent=e.message;}finally{if(url)setTimeout(()=>URL.revokeObjectURL(url),1000);if(gen===generation)el('legacyLocalExport').disabled=!prepared;}
};
window.SCLegacyLocalReviewUI={clear};window.addEventListener('storage',clear);
})();
