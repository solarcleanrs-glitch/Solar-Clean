(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SCScopedVistoriaStore=factory();})(typeof window==='undefined'?this:window,function(){
'use strict';
const PROJECT='https://zzphucuiqhzrilrddxnf.supabase.co',UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function scope(value){if(value?.project!==PROJECT||!UUID.test(value.actor||''))throw Error('Conta e projeto de testes obrigatórios.');return Object.freeze({project:PROJECT,actor:value.actor.toLowerCase()});}
function namespace(value){const s=scope(value);return 'solarCleanScopedVistorias:v1:zzphucuiqhzrilrddxnf:'+s.actor;}
function canonical(value){if(value===undefined||typeof value==='function'||typeof value==='symbol'||typeof value==='bigint'||typeof value==='number'&&!Number.isFinite(value))throw Error('Formato local não suportado; preserve o legado e revise a cópia.');if(value===null||typeof value!=='object')return JSON.stringify(value);if(!Array.isArray(value)&&Object.prototype.toString.call(value)!=='[object Object]')throw Error('Objeto binário ou especial exige conferência própria; preserve o legado.');if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';}
function record(value){if(!value||typeof value!=='object'||Array.isArray(value)||!(Number.isSafeInteger(value.id)&&value.id>0||typeof value.id==='string'&&value.id.trim()))throw Error('Registro local sem ID estável.');const copy=structuredClone(value);canonical(copy);return copy;}
function records(values){if(!Array.isArray(values))throw Error('Lista local inválida.');const seen=new Set();return values.map(v=>{const r=record(v),key=typeof r.id+':'+r.id;if(seen.has(key))throw Error('IDs locais repetidos.');seen.add(key);return r;});}
function session({context,backend}){
 const owner=scope(context()),name=namespace(owner);
 function check(){const now=scope(context());if(now.project!==owner.project||now.actor!==owner.actor)throw Error('Conta mudou; resultado local não deve ser exibido.');}
 return Object.freeze({namespace:name,owner,
  async list(){check();const rows=await backend.list(name);check();return records(rows);},
  async put(value){const r=record(value);check();await backend.put(name,r,check);check();return r.id;},
  async add(value){const r=record(value);check();await backend.add(name,r,check);check();return r.id;},
  async copyLegacy({sourceRecords,confirmedOwner}){
   if(namespace(confirmedOwner)!==name)throw Error('Confirme explicitamente a conta responsável pelo legado.');
   const source=records(sourceRecords);check();
   // Backend must compare and copy in one committed transaction; never overwrites conflicts.
   const result=await backend.copyMissing(name,source,check);check();
   const copied=records(await backend.list(name));check();const byId=new Map(copied.map(r=>[typeof r.id+':'+r.id,r]));
   for(const r of source)if(!byId.has(typeof r.id+':'+r.id)||canonical(r)!==canonical(byId.get(typeof r.id+':'+r.id)))throw Error('Cópia local não conferiu; legado deve permanecer preservado.');
   return {copied:result.copied,alreadyPresent:result.alreadyPresent,verified:source.length,namespace:name};
  }
 });
}
function indexedDBBackend(indexedDB){
 const STORE='vistorias';
 function open(name){if(!/^solarCleanScopedVistorias:v1:zzphucuiqhzrilrddxnf:[0-9a-f-]{36}$/.test(name))return Promise.reject(Error('Namespace inválido.'));return new Promise((resolve,reject)=>{const req=indexedDB.open(name,1);req.onupgradeneeded=()=>req.result.createObjectStore(STORE,{keyPath:'id'});req.onerror=()=>reject(req.error);req.onblocked=()=>reject(Error('Banco local bloqueado por outra aba.'));req.onsuccess=()=>resolve(req.result);});}
 async function transaction(name,mode,build,check=()=>{}){const db=await open(name);return new Promise((resolve,reject)=>{let tx,error,result,done=false;const finish=e=>{if(done)return;done=true;db.close();e?reject(e):resolve(result);};try{check();tx=db.transaction(STORE,mode);tx.oncomplete=()=>finish();tx.onabort=()=>finish(error||tx.error||Error('Transação local interrompida.'));tx.onerror=()=>{error=tx.error;};const fail=e=>{error=e;try{tx.abort();}catch{finish(e);}};build(tx.objectStore(STORE),r=>{result=r;},fail,check);}catch(e){if(tx){error=e;try{tx.abort();}catch{finish(e);}}else finish(e);}});}
 const list=name=>transaction(name,'readonly',(store,set,fail)=>{const req=store.getAll();req.onsuccess=()=>set(req.result);req.onerror=()=>fail(req.error);});
 const write=(method)=>(name,value,check)=>transaction(name,'readwrite',(store,set,fail)=>{const req=store[method](value);req.onsuccess=()=>set(req.result);req.onerror=()=>fail(req.error);},check);
 const copyMissing=(name,source,check)=>transaction(name,'readwrite',(store,set,fail)=>{const req=store.getAll();req.onerror=()=>fail(req.error);req.onsuccess=()=>{try{check();const existing=new Map(req.result.map(r=>[typeof r.id+':'+r.id,r]));let copied=0,alreadyPresent=0;for(const r of source){const key=typeof r.id+':'+r.id;if(existing.has(key)){if(canonical(existing.get(key))!==canonical(r))throw Error('Conflito no destino; nenhum registro deve ser substituído.');alreadyPresent++;}else copied++;}for(const r of source)if(!existing.has(typeof r.id+':'+r.id))store.add(r).onerror=e=>fail(e.target.error);set({copied,alreadyPresent});}catch(e){fail(e);}};},check);
 return {list,put:write('put'),add:write('add'),copyMissing};
}
return {scope,namespace,session,indexedDBBackend};
});
