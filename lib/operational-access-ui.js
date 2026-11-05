/* Candidate staging capability gate. Never trusts a displayed name or email. */
(()=>{'use strict';
if(location.hostname!=='solar-clean-testes-crm.pages.dev'&&!location.hostname.endsWith('.solar-clean-testes-crm.pages.dev'))return;
if(!window.SCOperationalAccess)return;
const status=document.createElement('p');status.id='operationalAccessStatus';status.className='small';status.setAttribute('role','status');document.getElementById('loggedUser').after(status);
const buttonCaps={newBtn:'visits_write',historyBtn:'reports_read',crmBtn:'crm',adminBtn:'admin',legacyAgendaFromField:'agenda_manage',fieldClientsLoad:'clients_read',fieldReportsLoad:'reports_read',agendaBtn:'agenda_read'};
let generation=0,timer=null,storageOwner='',storageScope=null;
const context=()=>({project:cloudConfig().url,actor:appDraftContext().actor,generation:authSessionGeneration,headers:crmHistoryCloudHeaders()});
const access=SCOperationalAccess.create({context,fetch:(...args)=>fetch(...args)});
function allowed(cap,unit=null){return access.allows(cap,unit);}
function actor(){try{return JSON.parse(atob((localStorage.getItem('solarCleanAccessToken')||'').split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub||'';}catch{return '';}}
function storageRevision(){return storageOwner===actor()?storageScope:null;}
function storageReady(){const p=access.current();return Boolean(p&&p.actor===storageOwner&&p.revision===storageScope);}
const rawButtons=new Set(['historyBtn','crmBtn','adminBtn']);
function canUseRaw(){return storageReady()&&['gestor','gestor_unidade'].includes(access.current()?.role);}
function permitted(id){return allowed(buttonCaps[id])&&(!rawButtons.has(id)||canUseRaw());}
function apply(){
 for(const [id]of Object.entries(buttonCaps)){const button=document.getElementById(id);if(button)button.disabled=!permitted(id);}
 for(const id of ['fieldAgendaUnit','serviceUnit','agendaUnit','agendaUnitFilter','chiUnit']){
  const input=document.getElementById(id);if(!input)continue;
  for(const option of input.options)if(['RS','SC'].includes(option.value))option.disabled=!access.current()?.units.includes(option.value);
  if(access.current()&&input.value&&!access.current().units.includes(input.value))input.value='';
 }
 for(const id of ['pagamentoStatus','pagamentoForma','valorCobrado','valorRecebido'])document.getElementById(id)?.closest('label')?.classList.toggle('hidden',!allowed('finance'));
 for(const id of ['fieldClientsSearch'])document.getElementById(id)?.classList.toggle('hidden',!allowed('clients_read'));
 document.getElementById('fieldClientsSection')?.classList.toggle('hidden',!allowed('clients_read'));
 const raw=storageReady()&&['gestor','gestor_unidade'].includes(access.current()?.role);
 const backup=document.getElementById('exportBackup');if(backup)backup.disabled=!raw;
 for(const id of ['googleConnectBtn','googleTestBtn'])if(document.getElementById(id))document.getElementById(id).disabled=access.current()?.role!=='gestor';
}
function clear(){generation++;clearTimeout(timer);access.clear();storageOwner='';storageScope=null;apply();refreshAppDraftList();status.textContent='Acesso ainda não confirmado. Conecte e entre na sua conta.';}
function suspend(){try{const finish=prepareAppDraftAccountChange();finish();}catch(error){quarantineAppDraft(error);}}
async function refresh(){
 const turn=++generation;clearTimeout(timer);access.clear();apply();refreshAppDraftList();status.textContent='Conferindo permissões…';
 try{
  if(!appDraftContext().actor)throw Error('Entre na conta da nuvem para consultar seu acesso.');
  await ensureVistoriaSession();if(turn!==generation)return null;
  const profile=await access.refresh();if(turn!==generation)return null;
  const changingScope=storageOwner===profile.actor&&storageScope!==profile.revision;
  const finish=changingScope?prepareAppDraftAccountChange():null;
  storageOwner=profile.actor;storageScope=profile.revision;
  if(finish)finish();
  apply();refreshAppDraftList();status.textContent='Acesso confirmado · '+profile.units.join(' / ')+(changingScope?' · Dados da permissão anterior preservados para conferência.':'');
  void updateDashboard().catch(()=>{});
  timer=setTimeout(()=>{void refresh();},60000);return profile;
 }catch(error){if(turn===generation){suspend();access.clear();storageOwner='';storageScope=null;apply();refreshAppDraftList();status.textContent=error.message;}}
 return null;
}
function sessionChanged(){clear();queueMicrotask(()=>void refresh());}
for(const [id,cap]of Object.entries(buttonCaps)){
 const button=document.getElementById(id);if(!button)continue;const previous=button.onclick;
 if(id==='fieldClientsLoad'||id==='fieldReportsLoad')continue;
 button.onclick=async event=>{const profile=await refresh();if(!profile||!permitted(id))return;return previous?.call(button,event);};
}
function canOpen(screen){
 const cap={formScreen:'visits_write',reportScreen:'reports_read',historyScreen:'reports_read',crmScreen:'crm',adminScreen:'admin',agendaScreen:'agenda_manage',fieldAgendaScreen:'agenda_read'}[screen];
 if(!cap)return true;
 if(['historyScreen','crmScreen','adminScreen'].includes(screen)&&!canUseRaw())return false;
 return allowed(cap);
}
async function requireAccess(cap,unit=null){const profile=await refresh();if(!profile||!allowed(cap,unit))throw Error('Operação não autorizada para este perfil/unidade.');return profile;}
window.SCOperationalAccessUI={refresh,clear,sessionChanged,require:requireAccess,allows:allowed,allowsUnit:unit=>Boolean(access.current()?.units.includes(unit)),current:access.current,canOpen,storageRevision,storageReady};
window.addEventListener('storage',sessionChanged);
window.addEventListener('online',()=>void refresh());
window.addEventListener('offline',()=>{suspend();clear();});
sessionChanged();
})();
