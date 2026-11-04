(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SCScopedLocalRuntime=factory();})(typeof window==='undefined'?this:window,function(){
'use strict';
const PROJECT='https://zzphucuiqhzrilrddxnf.supabase.co';
const PREFIX='solarCleanScopedOperational:v1:zzphucuiqhzrilrddxnf:';
const MODE='solarCleanScopedOperationalEnabled:v1:zzphucuiqhzrilrddxnf';
const KEYS=['solarCleanAgenda','solarCleanClients','solarCleanCrmMeta','solarCleanCrmContactHistory'];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function owner(value){if(value?.project!==PROJECT||!UUID.test(value.actor||''))throw Error('Entre na conta de testes antes de acessar os dados separados.');return {project:PROJECT,actor:value.actor.toLowerCase(),generation:value.generation};}
function canonical(value){if(value===undefined||typeof value==='function'||typeof value==='symbol'||typeof value==='bigint'||typeof value==='number'&&!Number.isFinite(value))throw Error('Registro não suportado; preserve o original.');if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(Object.prototype.toString.call(value)!=='[object Object]')throw Error('Mídia binária exige conferência própria.');return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';}
function records(values){if(!Array.isArray(values))throw Error('Lista de vistorias inválida.');const seen=new Set();return values.map(v=>{if(!v||typeof v!=='object'||!(typeof v.id==='string'&&v.id.trim()||Number.isSafeInteger(v.id)&&v.id>0))throw Error('Vistoria sem ID estável.');const key=typeof v.id+':'+v.id;if(seen.has(key))throw Error('ID local repetido.');seen.add(key);const r=structuredClone(v);canonical(r);return r;});}
function create({storage,context}){
 function enabled(){return context()?.project===PROJECT&&storage.getItem(MODE)==='1';}
 function fingerprint(){const c=context();return JSON.stringify([c?.project,c?.actor||'',c?.generation,storage.getItem(MODE)]);}
 function capture(){const before=fingerprint(),active=enabled(),who=active?owner(context()):null;return Object.freeze({active,owner:who,database:active?PREFIX+who.actor:'solarCleanDB',check(){if(before!==fingerprint())throw Error('Conta ou armazenamento mudou durante a operação.');}});}
 function key(name,snapshot=capture()){if(!KEYS.includes(name))throw Error('Chave não permitida.');snapshot.check();return snapshot.active?PREFIX+snapshot.owner.actor+':'+name:name;}
 function get(name){const snap=capture(),result=storage.getItem(key(name,snap));snap.check();return result;}
 function set(name,value){if(typeof value!=='string')throw Error('Texto local obrigatório.');const snap=capture();storage.setItem(key(name,snap),value);snap.check();}
 function legacySnapshot(){return Object.fromEntries(KEYS.map(k=>[k,storage.getItem(k)]));}
 function validateRaw(raw){for(const k of KEYS){const text=raw[k];if(text!==null&&typeof text!=='string')throw Error('Snapshot local inválido.');if(text!==null){let v;try{v=JSON.parse(text);}catch{throw Error('Dados locais ilegíveis; preserve o original.');}if(k==='solarCleanAgenda'||k==='solarCleanClients'){if(!Array.isArray(v))throw Error('Lista local inválida.');}else if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Metadados locais inválidos.');}}}
 async function copyAndEnable({confirmedOwner,sourceRecords,readLegacy,backend}){
  if(enabled())throw Error('Armazenamento separado já está ativo. Não recopie o legado.');
  const who=owner(context()),confirmed=owner(confirmedOwner);
  if(who.actor!==confirmed.actor)throw Error('Confirme a conta responsável por todos os registros.');
  const originalFingerprint=fingerprint(),name=PREFIX+who.actor,raw=legacySnapshot(),source=records(sourceRecords);
  const check=()=>{if(originalFingerprint!==fingerprint())throw Error('Conta ou armazenamento mudou durante a cópia.');};
  validateRaw(raw);
  for(const k of KEYS){const target=storage.getItem(name+':'+k);if(target!==null&&target!==raw[k])throw Error('Destino contém dados diferentes; nenhuma ativação permitida.');}
  if(canonical(records(await readLegacy()))!==canonical(source))throw Error('Vistorias antigas mudaram; confira novamente.');check();
  await backend.copyMissing(name,source,check);check();
  const copied=records(await backend.list(name)),byId=new Map(copied.map(r=>[typeof r.id+':'+r.id,r]));
  for(const r of source)if(canonical(byId.get(typeof r.id+':'+r.id))!==canonical(r))throw Error('Cópia de vistoria não conferiu.');
  if(copied.length!==source.length)throw Error('Destino contém outras vistorias; revise antes de ativar.');
  if(canonical(records(await readLegacy()))!==canonical(source))throw Error('Vistorias antigas mudaram durante a cópia.');check();
  if(canonical(legacySnapshot())!==canonical(raw))throw Error('Agenda ou CRM mudaram durante a cópia.');
  for(const k of KEYS){check();const target=name+':'+k;if(raw[k]!==null){storage.setItem(target,raw[k]);if(storage.getItem(target)!==raw[k])throw Error('Cópia local não foi confirmada.');}}
  check();if(canonical(legacySnapshot())!==canonical(raw))throw Error('Originais alterados; ativação interrompida.');
  storage.setItem(MODE,'1');if(storage.getItem(MODE)!=='1')throw Error('Ativação não confirmada.');
  return {actor:who.actor,verifiedVistorias:source.length,verifiedKeys:KEYS.length,database:name};
 }
 return Object.freeze({enabled,fingerprint,capture,key,get,set,legacySnapshot,copyAndEnable});
}
function indexedDBBackend(indexedDB){
 function open(name){
  if(!name.startsWith(PREFIX)||!UUID.test(name.slice(PREFIX.length)))return Promise.reject(Error('Banco separado inválido.'));
  return new Promise((resolve,reject)=>{let failed=false;const req=indexedDB.open(name,2);
   req.onupgradeneeded=()=>{const db=req.result;const store=db.objectStoreNames.contains('vistorias')?req.transaction.objectStore('vistorias'):db.createObjectStore('vistorias',{keyPath:'id',autoIncrement:true});for(const key of ['createdAt','cliente','cloudId'])if(!store.indexNames.contains(key))store.createIndex(key,key,{unique:false});};
   req.onerror=()=>{failed=true;reject(req.error);};req.onblocked=()=>{failed=true;reject(Error('Outra aba bloqueou o banco separado.'));};req.onsuccess=()=>{if(failed)req.result.close();else resolve(req.result);};
  });
 }
 async function transact(name,mode,build,check=()=>{}){
  const db=await open(name);return new Promise((resolve,reject)=>{let tx,error,result,done=false;
   const finish=e=>{if(done)return;done=true;db.close();if(!e)try{check();}catch(changed){e=changed;}e?reject(e):resolve(result);};
   const fail=e=>{error=e;try{tx.abort();}catch{finish(e);}};
   try{check();tx=db.transaction('vistorias',mode);tx.oncomplete=()=>finish();tx.onabort=()=>finish(error||tx.error||Error('Cópia local interrompida.'));tx.onerror=()=>{error=tx.error;};build(tx.objectStore('vistorias'),r=>{result=r;},fail,check);}catch(e){if(tx)fail(e);else finish(e);}
  });
 }
 return {
  list:name=>transact(name,'readonly',(store,set,fail)=>{const r=store.getAll();r.onerror=()=>fail(r.error);r.onsuccess=()=>set(r.result);}),
  copyMissing:(name,source,check)=>transact(name,'readwrite',(store,set,fail)=>{const r=store.getAll();r.onerror=()=>fail(r.error);r.onsuccess=()=>{try{check();const existing=new Map(records(r.result).map(v=>[typeof v.id+':'+v.id,v]));
   for(const value of source){const k=typeof value.id+':'+value.id;if(existing.has(k)&&canonical(existing.get(k))!==canonical(value))throw Error('Conflito no destino; preserve o original.');}
   let copied=0;for(const value of source)if(!existing.has(typeof value.id+':'+value.id)){copied++;const add=store.add(value);add.onerror=()=>fail(add.error);}set({copied});
  }catch(e){fail(e);}};},check)
 };
}
return {create,indexedDBBackend,PROJECT,MODE,KEYS,PREFIX};
});
