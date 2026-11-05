/* Read-only, global-manager review. Never imports or sends legacy records. */
(()=>{'use strict';
if(location.hostname!=='solar-clean-testes-crm.pages.dev'&&!location.hostname.endsWith('.solar-clean-testes-crm.pages.dev'))return;
const panel=document.getElementById('scopedMigrationPanel');if(!panel||!window.SCLegacyLocalReview)return;
panel.classList.remove('hidden');panel.innerHTML='<h3>Dados antigos deste aparelho</h3><p>Os dados anteriores continuam preservados. Somente o gestor global pode conferir e baixar uma cópia para revisão. A cópia não importa nem sincroniza registros e não atribui sua propriedade à conta atual.</p><label>Origem para conferência<select id="legacyLocalSource"><option value="solarCleanDB">Dados anteriores do aparelho</option></select></label><button id="legacyLocalInspect" type="button">Conferir dados antigos</button><button id="legacyLocalExport" type="button" disabled>Baixar cópia para revisão</button><p id="legacyLocalStatus" role="status"></p>';
const el=id=>document.getElementById(id);let generation=0,prepared=null;
function invalidate(){generation++;prepared=null;el('legacyLocalInspect').disabled=false;el('legacyLocalExport').disabled=true;el('legacyLocalStatus').textContent='';}
function clear(){invalidate();el('legacyLocalSource').replaceChildren();const option=document.createElement('option');option.value='solarCleanDB';option.textContent='Dados anteriores do aparelho';el('legacyLocalSource').append(option);}
el('legacyLocalSource').onchange=invalidate;
function context(){return {...appDraftContext(),generation:authSessionGeneration,url:cloudConfig().url};}
async function authorize(){
 if(!navigator.onLine||cloudConfig().url!=='https://zzphucuiqhzrilrddxnf.supabase.co')throw Error('Entre na nuvem e conecte à internet no projeto de testes.');
 const guard=captureVistoriaOperationGuard();await ensureVistoriaSession();guard();
 const response=await fetch(cloudConfig().url+'/rest/v1/rpc/sc_is_manager',{method:'POST',headers:crmHistoryCloudHeaders(),body:'{}'});guard();
 if(!response.ok)throw Error('Não foi possível conferir o acesso de gestor.');const result=await response.json();guard();return result===true;
}
el('legacyLocalInspect').onclick=async()=>{const selected=el('legacyLocalSource').value;invalidate();const gen=generation;el('legacyLocalInspect').disabled=true;el('legacyLocalStatus').textContent='Conferindo acesso e dados antigos…';
 try{const sources=await SCLegacyLocalReview.listSources({context,authorize,storage:localStorage,indexedDB});if(gen!==generation)return;
  el('legacyLocalSource').replaceChildren();for(const source of sources){const option=document.createElement('option');option.value=source.database;option.textContent=source.kind==='device-legacy'?'Dados anteriores do aparelho':(source.kind==='permission-cache'?'Dados por permissão':'Dados por conta')+' · '+source.actor.slice(0,8)+(source.accessRevision?' / '+source.accessRevision.slice(0,8):'');el('legacyLocalSource').append(option);}
  el('legacyLocalSource').value=sources.some(s=>s.database===selected)?selected:'solarCleanDB';const source=el('legacyLocalSource').value;
  const result=await SCLegacyLocalReview.prepare({context,authorize,source,storage:localStorage,readRecords:()=>SCLegacyLocalReview.readLegacy(indexedDB,source)});if(gen!==generation)return;prepared=result;el('legacyLocalExport').disabled=false;el('legacyLocalStatus').textContent=result.count+' vistoria(s) antiga(s), '+result.pending+' pendente(s). Confira a propriedade antes de qualquer importação. Nenhum registro foi copiado para a conta atual.';}
 catch(e){if(gen===generation)el('legacyLocalStatus').textContent=e.message;}finally{if(gen===generation)el('legacyLocalInspect').disabled=false;}
};
el('legacyLocalExport').onclick=async()=>{if(!prepared)return;const item=prepared,gen=generation;el('legacyLocalExport').disabled=true;let url;
 try{await item.verify();if(gen!==generation)return;item.check();url=URL.createObjectURL(new Blob([item.text],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='solar-clean-legado-para-revisao.json';link.click();el('legacyLocalStatus').textContent='Cópia preparada para download. Os originais continuam preservados, sem importação ou sincronização.';}
 catch(e){if(gen===generation)el('legacyLocalStatus').textContent=e.message;}finally{if(url)setTimeout(()=>URL.revokeObjectURL(url),1000);if(gen===generation)el('legacyLocalExport').disabled=!prepared;}
};
window.SCLegacyLocalReviewUI={clear};window.addEventListener('storage',clear);
})();
