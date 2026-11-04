/* Candidate staging capability gate. Never trusts a displayed name or email. */
(()=>{'use strict';
if(location.hostname!=='solar-clean-testes-crm.pages.dev'&&!location.hostname.endsWith('.solar-clean-testes-crm.pages.dev'))return;
if(!window.SCOperationalAccess)return;
const status=document.createElement('p');status.id='operationalAccessStatus';status.className='small';status.setAttribute('role','status');document.getElementById('loggedUser').after(status);
const buttonCaps={newBtn:'visits_write',historyBtn:'reports_read',crmBtn:'crm',adminBtn:'admin',legacyAgendaFromField:'agenda_manage',fieldClientsLoad:'clients_read',fieldReportsLoad:'reports_read',agendaBtn:'agenda_read'};
let generation=0,timer=null,last=null;
const context=()=>({project:cloudConfig().url,actor:appDraftContext().actor,generation:authSessionGeneration,headers:crmHistoryCloudHeaders()});
const access=SCOperationalAccess.create({context,fetch:(...args)=>fetch(...args)});
function allowed(cap,unit=null){return access.allows(cap,unit);}
// Existing raw local history/CRM can contain records from an older, broader
// grant. Keep those views global-only until their cache scope is versioned.
const rawButtons=new Set(['historyBtn','crmBtn','adminBtn']);
function permitted(id){return allowed(buttonCaps[id])&&(!rawButtons.has(id)||access.current()?.role==='gestor');}
function apply(){
 for(const [id]of Object.entries(buttonCaps)){const button=document.getElementById(id);if(button)button.disabled=!permitted(id);}
 for(const id of ['fieldAgendaUnit','serviceUnit','agendaUnit','agendaUnitFilter','chiUnit']){
  const input=document.getElementById(id);if(!input)continue;
  for(const option of input.options)if(['RS','SC'].includes(option.value))option.disabled=!access.current()?.units.includes(option.value);
  if(access.current()&&input.value&&!access.current().units.includes(input.value))input.value='';
 }
 for(const id of ['pagamentoStatus','pagamentoForma','valorCobrado','valorRecebido'])document.getElementById(id)?.closest('label')?.classList.toggle('hidden',!allowed('finance'));
 for(const id of ['fieldClientsSearch'])document.getElementById(id)?.classList.toggle('hidden',!allowed('clients_read'));
 const raw=access.current()?.role==='gestor';
 const backup=document.getElementById('exportBackup');if(backup)backup.disabled=!raw;
}
function clear(){generation++;clearTimeout(timer);access.clear();apply();status.textContent='Acesso ainda não confirmado. Conecte e entre na sua conta.';}
function suspend(){try{const finish=prepareAppDraftAccountChange();finish();}catch(error){quarantineAppDraft(error);}}
async function refresh(){
 const turn=++generation;clearTimeout(timer);access.clear();apply();status.textContent='Conferindo permissões…';
 try{
  if(!appDraftContext().actor)throw Error('Entre na conta da nuvem para consultar seu acesso.');
  await ensureVistoriaSession();if(turn!==generation)return null;
  const profile=await access.refresh();if(turn!==generation)return null;
  if(last?.actor===profile.actor&&last.revision!==profile.revision){const finish=prepareAppDraftAccountChange();finish();}
  last=profile;apply();status.textContent='Acesso confirmado · '+profile.units.join(' / ');
  if(profile.role==='gestor')void updateDashboard().catch(()=>{});
  timer=setTimeout(()=>{void refresh();},60000);return profile;
 }catch(error){if(turn===generation){suspend();access.clear();apply();status.textContent=error.message;}}
 return null;
}
function sessionChanged(){clear();last=null;queueMicrotask(()=>void refresh());}
for(const [id,cap]of Object.entries(buttonCaps)){
 const button=document.getElementById(id);if(!button)continue;const previous=button.onclick;
 if(id==='fieldClientsLoad'||id==='fieldReportsLoad')continue;
 button.onclick=async event=>{const profile=await refresh();if(!profile||!permitted(id))return;return previous?.call(button,event);};
}
function canOpen(screen){
 const cap={formScreen:'visits_write',reportScreen:'reports_read',historyScreen:'reports_read',crmScreen:'crm',adminScreen:'admin',agendaScreen:'agenda_manage',fieldAgendaScreen:'agenda_read'}[screen];
 if(!cap)return true;
 if(['historyScreen','crmScreen','adminScreen'].includes(screen)&&access.current()?.role!=='gestor')return false;
 return allowed(cap);
}
async function requireAccess(cap,unit=null){const profile=await refresh();if(!profile||!allowed(cap,unit))throw Error('Operação não autorizada para este perfil/unidade.');return profile;}
window.SCOperationalAccessUI={refresh,clear,sessionChanged,require:requireAccess,allows:allowed,allowsUnit:unit=>Boolean(access.current()?.units.includes(unit)),current:access.current,canOpen};
window.addEventListener('storage',sessionChanged);
window.addEventListener('online',()=>void refresh());
window.addEventListener('offline',()=>{suspend();clear();});
sessionChanged();
})();
