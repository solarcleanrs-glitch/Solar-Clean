/* Recovery rehearsal only: this module never writes operational stores or calls the network. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else {root.SCBackupRecovery=api;api.mount();}
})(typeof window==='undefined'?this:window,function(){
'use strict';
const PROJECT='https://zzphucuiqhzrilrddxnf.supabase.co';
const KEYS=['solarCleanAgenda','solarCleanClients','solarCleanCrmMeta','solarCleanCrmContactHistory'];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function inspect(text,actor){
  if(typeof text!=='string'||text.length>100*1024*1024)throw Error('Arquivo ausente ou acima do limite de 100 MB.');
  let data;try{data=JSON.parse(text)}catch(e){throw Error('Arquivo JSON ilegível. Preserve o original.');}
  if(!data||data.app!=='Solar Clean Vistorias v4'||!Array.isArray(data.vistorias)||!Number.isFinite(Date.parse(data.exportedAt)))throw Error('Formato de backup inválido.');
  const local=data.stagingLocal;
  if(!local||local.version!==1||local.project!==PROJECT)throw Error('Use um backup ampliado do projeto de testes (revisão 11 ou posterior).');
  if(!UUID.test(actor||'')||!UUID.test(local.actor||'')||local.actor.toLowerCase()!==actor.toLowerCase())throw Error('O backup deve pertencer à mesma conta conectada.');
  if(!local.raw||typeof local.raw!=='object'||Array.isArray(local.raw)||Object.keys(local.raw).some(key=>!KEYS.includes(key)))throw Error('Chaves locais não reconhecidas.');
  const ids=new Set();let pending=0;
  for(const row of data.vistorias){
    if(!row||typeof row!=='object'||!Number.isSafeInteger(row.id)||row.id<1||ids.has(row.id))throw Error('Identificação de vistoria inválida ou repetida.');
    ids.add(row.id);if(row.syncStatus!=='synced')pending++;
  }
  const counts={},warnings=[];
  for(const key of KEYS){
    const raw=local.raw[key];
    if(raw!==null&&typeof raw!=='string')throw Error('Conteúdo local ausente ou inválido.');
    if(raw===null){counts[key]=0;continue;}
    try{const value=JSON.parse(raw);const arrayExpected=key==='solarCleanAgenda'||key==='solarCleanClients';
      if(value===null||typeof value!=='object'||Array.isArray(value)!==arrayExpected)throw Error();
      counts[key]=Array.isArray(value)?value.length:Object.keys(value).length;
    }catch(e){warnings.push(key+': texto preservado, conteúdo precisa de revisão.');counts[key]=null;}
  }
  let financialPhase='ausente';
  if(local.financialIntent!==null){
    const journal=local.financialIntent;
    if(!journal||journal.key!=='solarCleanSettlementIntent:v1:zzphucuiqhzrilrddxnf:'+actor.toLowerCase()||(journal.raw!==null&&typeof journal.raw!=='string'))throw Error('Operação financeira de outra conta ou formato inválido.');
    if(journal.raw!==null){
      try{const state=JSON.parse(journal.raw);
        if(state.actor.toLowerCase()!==actor.toLowerCase()||!['pending','confirmed','rejected'].includes(state.phase)||!state.intent||state.fingerprint!==JSON.stringify(state.intent))throw Error();
        financialPhase=state.phase;
      }catch(e){financialPhase='ilegível';warnings.push('Operação financeira preservada para revisão, sem reenvio.');}
    }
  }
  return {exportedAt:data.exportedAt,vistorias:data.vistorias.length,pending,counts,financialPhase,warnings};
}
async function rehearse({text,actor,backend,checkContext,id}){
  const summary=inspect(text,actor);checkContext();
  // add, never put: an existing rehearsal is never replaced.
  await backend.add({id,actor:actor.toLowerCase(),text,createdAt:new Date().toISOString()});
  checkContext();
  const restored=await backend.read(id);checkContext();
  if(!restored||restored.actor!==actor.toLowerCase()||restored.text!==text)throw Error('Releitura não confirmou a cópia isolada. Preserve o arquivo original.');
  const reread=inspect(restored.text,actor);
  if(JSON.stringify(summary)!==JSON.stringify(reread))throw Error('Conferência da cópia divergiu.');
  return reread;
}
function isolatedBackend(){
  function open(){return new Promise((resolve,reject)=>{
    const req=indexedDB.open('solarCleanRecoveryLab',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('archives',{keyPath:'id'});
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(Error('Não foi possível abrir o espaço isolado.'));
    req.onblocked=()=>reject(Error('Espaço de recuperação bloqueado por outra aba.'));
  });}
  return {
    async add(record){const db=await open();try{await new Promise((resolve,reject)=>{
      const tx=db.transaction('archives','readwrite');tx.objectStore('archives').add(record);
      tx.oncomplete=()=>resolve();tx.onabort=()=>reject(Error('Cópia isolada não gravada. Verifique espaço disponível.'));tx.onerror=()=>{};
    });}finally{db.close();}},
    async read(id){const db=await open();try{return await new Promise((resolve,reject)=>{
      const tx=db.transaction('archives','readonly');const req=tx.objectStore('archives').get(id);let result;
      req.onsuccess=()=>{result=req.result};tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(Error('Falha na releitura isolada.'));
    });}finally{db.close();}}
  };
}
function mount(){
  const panel=document.getElementById('backupRecovery');
  if(!panel||location.hostname!=='solar-clean-testes-crm.pages.dev')return;
  panel.classList.remove('hidden');
  const file=document.getElementById('backupRecoveryFile'),preview=document.getElementById('backupRecoveryPreview'),save=document.getElementById('backupRecoverySave'),ack=document.getElementById('backupRecoveryAck');
  let prepared=null,busy=false;
  function context(){const snap=captureStagingBackupLocal();if(!snap?.actor||!currentTech()?.cloud)throw Error('Entre na nuvem com a conta que exportou o backup.');return snap.actor;}
  function summaryText(s){return 'Vistorias: '+s.vistorias+'; não marcadas como sincronizadas: '+s.pending+'. Agenda: '+(s.counts.solarCleanAgenda??'revisar')+'; clientes CRM: '+(s.counts.solarCleanClients??'revisar')+'. Operação financeira: '+s.financialPhase+'.\n'+s.warnings.join('\n');}
  file.onchange=async()=>{
    if(busy)return;prepared=null;save.disabled=true;ack.checked=false;
    const chosen=file.files[0];if(!chosen){preview.textContent='';return;}
    try{if(chosen.size>100*1024*1024)throw Error('Limite de 100 MB.');const actor=context();const text=await chosen.text();
      if(context()!==actor||file.files[0]!==chosen)throw Error('Conta ou arquivo mudou. Selecione novamente.');
      const summary=inspect(text,actor);prepared={actor,text,file:chosen};preview.textContent=summaryText(summary)+'\nPrévia pronta. O teste grava e relê uma cópia em espaço separado. Não recupera o banco nem baixa fotos remotas.';
    }catch(e){preview.textContent=e.message;}
  };
  ack.onchange=()=>{save.disabled=!prepared||!ack.checked||busy;};
  save.onclick=async()=>{
    if(!prepared||!ack.checked||busy)return;busy=true;save.disabled=true;file.disabled=true;ack.disabled=true;
    const selection=prepared;
    function checkContext(){if(context()!==selection.actor||file.files[0]!==selection.file)throw Error('Contexto mudou. A cópia, se gravada, permanece isolada.');}
    try{checkContext();const summary=await rehearse({text:selection.text,actor:selection.actor,backend:isolatedBackend(),checkContext,id:crypto.randomUUID()});
      preview.textContent='Cópia isolada gravada e relida integralmente.\n'+summaryText(summary)+'\nDados de trabalho e nuvem não foram alterados. Ainda falta testar a promoção para uso no aplicativo.';
      prepared=null;ack.checked=false;
    }catch(e){preview.textContent=e.message;prepared=null;ack.checked=false;}
    finally{busy=false;file.disabled=false;ack.disabled=false;save.disabled=true;}
  };
}
return {inspect,rehearse,mount};
});
