(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SCLegacyLocalReview=api;})(typeof window==='undefined'?this:window,function(){
'use strict';
const PROJECT='https://zzphucuiqhzrilrddxnf.supabase.co',KEYS=['solarCleanAgenda','solarCleanClients','solarCleanCrmMeta','solarCleanCrmContactHistory'];
const CACHE=/^solarCleanScopedOperational:v1:zzphucuiqhzrilrddxnf:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?::access:([a-f0-9]{32}))?$/;
const CACHE_PREFIX='solarCleanScopedOperational:v1:zzphucuiqhzrilrddxnf:';
const ACTOR='([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})';
const JOURNAL=new RegExp('^solarCleanSettlementIntent:v1:zzphucuiqhzrilrddxnf:'+ACTOR+'(?::access:([a-f0-9]{32}))?$');
const IMPORT=new RegExp('^solarCleanClientImport:v1:zzphucuiqhzrilrddxnf:'+ACTOR+'(?::access:([a-f0-9]{32}))?:');
const DRAFT1=new RegExp('^solarCleanDraft:v1:'+ACTOR+':'+ACTOR+'$');
const DRAFT2=new RegExp('^solarCleanDraft:v2:'+ACTOR+':([a-f0-9]{32}):'+ACTOR+'$');
function sourceInfo(name='solarCleanDB'){
 if(name==='solarCleanDB')return {database:name,prefix:'',kind:'device-legacy',actor:null,accessRevision:null};
 const match=typeof name==='string'&&name.match(CACHE);if(!match)throw Error('Origem de conferência não reconhecida.');
 return {database:name,prefix:name+':',kind:match[2]?'permission-cache':'account-cache',actor:match[1],accessRevision:match[2]||null};
}
function sourceForKey(key){
 let match;if(match=key?.match(JOURNAL)||key?.match(IMPORT)||key?.match(DRAFT2))return CACHE_PREFIX+match[1]+(match[2]?':access:'+match[2]:'');
 if(match=key?.match(DRAFT1))return CACHE_PREFIX+match[1];return null;
}
function extras(storage,origin){
 if(!origin.actor)return {financialIntent:null,clientImportIntents:[],drafts:[]};
 const suffix=origin.actor+(origin.accessRevision?':access:'+origin.accessRevision:'');
 const financialKey='solarCleanSettlementIntent:v1:zzphucuiqhzrilrddxnf:'+suffix;
 const importPrefix='solarCleanClientImport:v1:zzphucuiqhzrilrddxnf:'+suffix+':';
 const draftPrefix=origin.accessRevision?'solarCleanDraft:v2:'+origin.actor+':'+origin.accessRevision+':':'solarCleanDraft:v1:'+origin.actor+':';
 const clientImportIntents=[],drafts=[];
 for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith(importPrefix)&&sourceForKey(key)===origin.database)clientImportIntents.push({key,raw:storage.getItem(key)});if(key?.startsWith(draftPrefix)&&sourceForKey(key)===origin.database)drafts.push({key,raw:storage.getItem(key)});}
 for(const list of [clientImportIntents,drafts])list.sort((a,b)=>a.key.localeCompare(b.key));
 return {financialIntent:{key:financialKey,raw:storage.getItem(financialKey)},clientImportIntents,drafts};
}
function canonical(v,seen=new Set()){
 if(v===null||typeof v==='string'||typeof v==='boolean')return JSON.stringify(v);
 if(typeof v==='number'&&Number.isFinite(v))return JSON.stringify(v);
 if(!v||typeof v!=='object'||seen.has(v)||Object.getOwnPropertySymbols(v).length)throw Error('Formato local não exportável integralmente. Preserve a base original.');
 if(!Array.isArray(v)&&Object.prototype.toString.call(v)!=='[object Object]')throw Error('Mídia binária exige conferência própria. Preserve a base original.');
 seen.add(v);let result;
 if(Array.isArray(v)){
  if(Object.keys(v).length!==v.length||Array.from({length:v.length},(_,i)=>i).some(i=>!Object.hasOwn(v,i)))throw Error('Lista incompleta; preserve a base original.');
  result='['+v.map(x=>canonical(x,seen)).join(',')+']';
 }else result='{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k],seen)).join(',')+'}';
 seen.delete(v);return result;
}
// Opening without a version never upgrades an existing database. Abort creation
// when absent; all access to an existing store uses a readonly transaction.
function readLegacy(indexedDB,database='solarCleanDB'){return new Promise((resolve,reject)=>{
 const source=sourceInfo(database);
 let absent=false,settled=false;const req=indexedDB.open(source.database);
 const fail=e=>{if(!settled){settled=true;reject(e);}};
 req.onupgradeneeded=()=>{absent=true;req.transaction.abort();};
 req.onerror=()=>{if(absent){settled=true;resolve([]);}else fail(req.error);};
 req.onblocked=()=>fail(Error('Feche outras abas para conferir o armazenamento antigo.'));
 req.onsuccess=()=>{const db=req.result;if(settled){db.close();return;}
  if(!db.objectStoreNames.contains('vistorias')){db.close();settled=true;resolve([]);return;}
  let tx,rows;try{tx=db.transaction('vistorias','readonly');const read=tx.objectStore('vistorias').getAll();read.onsuccess=()=>{rows=read.result;};
   tx.oncomplete=()=>{db.close();settled=true;resolve(rows);};tx.onabort=()=>{db.close();fail(tx.error||Error('Conferência interrompida.'));};
  }catch(e){db.close();fail(e);}
 };
});}
async function listSources({context,authorize,indexedDB,storage}){
 const before=JSON.stringify(context()),c=context();
 if(c.project!==PROJECT||!/^[0-9a-f-]{36}$/i.test(c.actor||''))throw Error('Entre no projeto de testes.');
 if(await authorize()!==true)throw Error('Conferência disponível somente ao gestor global.');
 const check=()=>{if(JSON.stringify(context())!==before)throw Error('A sessão mudou durante a conferência.');};check();
 const names=new Set(['solarCleanDB']);
 if(typeof indexedDB.databases==='function')for(const row of await indexedDB.databases()){check();if(CACHE.test(row.name||''))names.add(row.name);}
 for(let i=0;i<storage.length;i++){check();const key=storage.key(i),fromQueue=sourceForKey(key);if(fromQueue)names.add(fromQueue);for(const suffix of KEYS)if(key?.endsWith(':'+suffix)){const name=key.slice(0,-suffix.length-1);if(CACHE.test(name))names.add(name);}}
 check();return [...names].sort((a,b)=>a==='solarCleanDB'?-1:b==='solarCleanDB'?1:a.localeCompare(b)).map(sourceInfo);
}
async function prepare({context,authorize,readRecords,storage,source:sourceName='solarCleanDB'}){
 const origin=sourceInfo(sourceName);
 const source={...context()},fingerprint=JSON.stringify(source);
 const check=()=>{if(JSON.stringify(context())!==fingerprint)throw Error('A sessão mudou. Confira novamente com o gestor.');};
 if(source.project!==PROJECT||!/^[0-9a-f-]{36}$/i.test(source.actor||''))throw Error('Entre no projeto de testes.');
 if(await authorize()!==true)throw Error('Conferência do legado disponível somente ao gestor global.');check();
 const raw=()=>Object.fromEntries(KEYS.map(key=>[key,storage.getItem(origin.prefix+key)]));
 const firstRaw=raw(),firstExtras=extras(storage,origin),records=await readRecords();check();
 if(!Array.isArray(records))throw Error('Base antiga inválida.');
 const first=canonical(records),again=await readRecords();check();
 if(first!==canonical(again)||canonical(firstRaw)!==canonical(raw())||canonical(firstExtras)!==canonical(extras(storage,origin)))throw Error('Os dados antigos mudaram durante a conferência. Tente novamente.');
 // Reviewer identity is provenance, never a claim that legacy records belong to them.
 const data={format:'Solar Clean — conferência de legado local',version:1,exportedAt:new Date().toISOString(),project:PROJECT,reviewedBy:source.actor,ownership:'unclassified-device-data',source:origin,vistorias:records,raw:firstRaw,queues:firstExtras};
 const text=JSON.stringify(data);canonical(data);check();
 return {count:records.length,pending:records.filter(r=>r.syncStatus!=='synced'||!r.cloudId).length,text,check,
  async verify(){check();if(await authorize()!==true)throw Error('Permissão de gestor revogada.');check();if(first!==canonical(await readRecords())||canonical(firstRaw)!==canonical(raw())||canonical(firstExtras)!==canonical(extras(storage,origin)))throw Error('Dados antigos alterados. Confira novamente.');check();}};
}
return {prepare,readLegacy,listSources,sourceInfo};
});
