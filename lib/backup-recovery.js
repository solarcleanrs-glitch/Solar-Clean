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
  const imports=local.clientImportIntents??[];
  if(!Array.isArray(imports))throw Error('Fila de importação inválida.');
  const importKeys=new Set(),prefix='solarCleanClientImport:v1:zzphucuiqhzrilrddxnf:'+actor.toLowerCase()+':';
  for(const entry of imports){if(!entry||typeof entry.key!=='string'||!entry.key.startsWith(prefix)||typeof entry.raw!=='string'||importKeys.has(entry.key))throw Error('Fila de importação de outra conta ou formato inválido.');importKeys.add(entry.key);}
  if(imports.length)warnings.push('Operações de importação preservadas como texto, sem comparação ou reenvio automático.');
  return {exportedAt:data.exportedAt,vistorias:data.vistorias.length,pending,counts,financialPhase,clientImportIntents:imports.length,warnings};
}
// Conservative comparison only; no plan is executable as a write request.
function canonical(value){
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
function compareCollections(backup,current,identity,collides=()=>false){
  if(!Array.isArray(backup)||!Array.isArray(current))throw Error('Coleção inválida para comparação.');
  function keyed(rows){const map=new Map();for(const row of rows){const key=identity(row);if(!key||map.has(key))throw Error('Identificação ausente ou repetida: comparação bloqueada.');map.set(key,row);}return map;}
  const source=keyed(backup),target=keyed(current),counts={equal:0,missing:0,conflict:0,currentOnly:0};
  for(const [key,row] of source){
    if(!target.has(key)){if(collides(row,current))counts.conflict++;else counts.missing++;}
    else if(canonical(row)===canonical(target.get(key)))counts.equal++;
    else counts.conflict++;
  }
  for(const key of target.keys())if(!source.has(key))counts.currentOnly++;
  return counts;
}
function planRecovery(text,actor,current){
  inspect(text,actor);
  if(!current||current.project!==PROJECT||current.actor!==actor.toLowerCase())throw Error('Contexto atual incompatível.');
  const data=JSON.parse(text),plan={},raw=data.stagingLocal.raw;
  function attempt(label,fn){try{plan[label]=fn()}catch(e){plan[label]={blocked:true,reason:e.message};}}
  // UUID is the remote identity. Local ID remains part of equality: remapping needs review.
  attempt('vistorias',()=>compareCollections(data.vistorias,current.vistorias,row=>{
    if(row?.cloudId){if(!UUID.test(row.cloudId))return null;return 'uuid:'+row.cloudId.toLowerCase();}
    return Number.isSafeInteger(row?.id)&&row.id>0?'local:'+row.id:null;
  },(row,rows)=>rows.some(other=>other.id===row.id)));
  for(const key of KEYS)attempt(key,()=>{
    const arrayExpected=key==='solarCleanAgenda'||key==='solarCleanClients';
    const parse=value=>{const parsed=value===null?(arrayExpected?[]:{}):JSON.parse(value);
      if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)!==arrayExpected)throw Error('Conteúdo ilegível ou formato incompatível.');return parsed;};
    const source=parse(raw[key]),target=parse(current.raw[key]);
    if(arrayExpected)return compareCollections(source,target,row=>typeof row?.id==='string'&&row.id?row.id:null);
    return compareCollections(Object.entries(source).map(([id,value])=>({id,value})),Object.entries(target).map(([id,value])=>({id,value})),row=>row.id);
  });
  const sourceJournal=data.stagingLocal.financialIntent?.raw??null,targetJournal=current.financialIntent?.raw??null;
  plan.financialIntent=sourceJournal===targetJournal?'igual':sourceJournal===null?'somente no aparelho atual':targetJournal===null?'somente no backup; conferir ID antes de qualquer reenvio':'divergente; revisão manual obrigatória';
  return plan;
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
  function planText(plan){
    const labels={vistorias:'Vistorias',solarCleanAgenda:'Agenda',solarCleanClients:'Clientes CRM',solarCleanCrmMeta:'Metadados CRM',solarCleanCrmContactHistory:'Histórico de contatos'};
    return 'Comparação com o aparelho (somente leitura):\n'+Object.entries(labels).map(([key,label])=>{
      const c=plan[key];return label+': '+(c.blocked?'comparação bloqueada — '+c.reason:c.equal+' iguais; '+c.missing+' ausentes no aparelho; '+c.conflict+' divergentes; '+c.currentOnly+' somente no aparelho.');
    }).join('\n')+'\nOperação financeira: '+plan.financialIntent+'. Nenhum item será aplicado por esta comparação.';
  }
  file.onchange=async()=>{
    if(busy)return;prepared=null;save.disabled=true;ack.checked=false;
    const chosen=file.files[0];if(!chosen){preview.textContent='';return;}
    try{if(chosen.size>100*1024*1024)throw Error('Limite de 100 MB.');const actor=context();const text=await chosen.text();
      if(context()!==actor||file.files[0]!==chosen)throw Error('Conta ou arquivo mudou. Selecione novamente.');
      const summary=inspect(text,actor);const before=captureStagingBackupLocal();const rows=await dbAll();
      if(context()!==actor||file.files[0]!==chosen||canonical(before)!==canonical(captureStagingBackupLocal()))throw Error('Dados ou conta mudaram. Selecione o arquivo novamente.');
      const plan=planRecovery(text,actor,{...before,vistorias:rows});prepared={actor,text,file:chosen};preview.textContent=summaryText(summary)+'\n'+planText(plan)+'\nPrévia pronta. O teste grava e relê uma cópia em espaço separado. Não recupera o banco nem baixa fotos remotas.';
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
return {inspect,rehearse,planRecovery,mount};
});
