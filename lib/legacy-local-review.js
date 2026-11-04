(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SCLegacyLocalReview=api;})(typeof window==='undefined'?this:window,function(){
'use strict';
const PROJECT='https://zzphucuiqhzrilrddxnf.supabase.co',KEYS=['solarCleanAgenda','solarCleanClients','solarCleanCrmMeta','solarCleanCrmContactHistory'];
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
function readLegacy(indexedDB){return new Promise((resolve,reject)=>{
 let absent=false,settled=false;const req=indexedDB.open('solarCleanDB');
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
async function prepare({context,authorize,readRecords,storage}){
 const source={...context()},fingerprint=JSON.stringify(source);
 const check=()=>{if(JSON.stringify(context())!==fingerprint)throw Error('A sessão mudou. Confira novamente com o gestor.');};
 if(source.project!==PROJECT||!/^[0-9a-f-]{36}$/i.test(source.actor||''))throw Error('Entre no projeto de testes.');
 if(await authorize()!==true)throw Error('Conferência do legado disponível somente ao gestor global.');check();
 const raw=()=>Object.fromEntries(KEYS.map(key=>[key,storage.getItem(key)]));
 const firstRaw=raw(),records=await readRecords();check();
 if(!Array.isArray(records))throw Error('Base antiga inválida.');
 const first=canonical(records),again=await readRecords();check();
 if(first!==canonical(again)||canonical(firstRaw)!==canonical(raw()))throw Error('Os dados antigos mudaram durante a conferência. Tente novamente.');
 // Reviewer identity is provenance, never a claim that legacy records belong to them.
 const data={format:'Solar Clean — conferência de legado local',version:1,exportedAt:new Date().toISOString(),project:PROJECT,reviewedBy:source.actor,ownership:'unclassified-device-data',vistorias:records,raw:firstRaw};
 const text=JSON.stringify(data);canonical(data);check();
 return {count:records.length,pending:records.filter(r=>r.syncStatus!=='synced'||!r.cloudId).length,text,check,
  async verify(){check();if(await authorize()!==true)throw Error('Permissão de gestor revogada.');check();if(first!==canonical(await readRecords())||canonical(firstRaw)!==canonical(raw()))throw Error('Dados antigos alterados. Confira novamente.');check();}};
}
return {prepare,readLegacy};
});
