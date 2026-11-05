(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SCAccountDraftVault=factory();})(typeof window==='undefined'?this:window,function(){
'use strict';
// Candidate integration stays gated by account-scoped storage in the app.
// This module never enables that mode or changes authentication credentials.
const PROJECT='https://zzphucuiqhzrilrddxnf.supabase.co';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function assertJson(value,seen=new Set()){
  if(value===null||typeof value==='string'||typeof value==='boolean')return;
  if(typeof value==='number'&&Number.isFinite(value))return;
  if(typeof value!=='object'||seen.has(value))throw Error('Conteúdo não pode ser preservado integralmente.');
  if(!Array.isArray(value)&&Object.prototype.toString.call(value)!=='[object Object]')throw Error('Mídia binária exige preservação própria.');
  seen.add(value);
  for(const key of Object.keys(value))assertJson(value[key],seen);
  if(Object.getOwnPropertySymbols(value).length)throw Error('Conteúdo não pode ser preservado integralmente.');
  if(Array.isArray(value)&&(Object.keys(value).length!==value.length||Array.from({length:value.length},(_,i)=>i).some(i=>!Object.prototype.hasOwnProperty.call(value,i))))throw Error('Lista incompleta no rascunho.');
  seen.delete(value);
}
function create({storage,context}){
  function session(){
    const c=context();
    if(c.project!==PROJECT||!UUID.test(c.actor||''))throw Error('Conta de testes identificada obrigatória.');
    if((c.requireAccessScope||c.accessRevision!=null)&&!/^[a-f0-9]{32}$/.test(c.accessRevision||''))throw Error('Permissão de rascunho ainda não confirmada.');
    return {...c,actor:c.actor.toLowerCase(),accessRevision:c.accessRevision??undefined};
  }
  function guard(c){const n=session();if(n.actor!==c.actor||n.generation!==c.generation||n.accessRevision!==c.accessRevision)throw Error('A conta mudou ou a permissão foi alterada; rascunho preservado.');}
  function prefix(c){return c.accessRevision?`solarCleanDraft:v2:${c.actor}:${c.accessRevision}:`:`solarCleanDraft:v1:${c.actor}:`;}
  function key(c,id){if(!UUID.test(id||''))throw Error('Identificador de rascunho inválido.');return prefix(c)+id.toLowerCase();}
  function read(id){
    const c=session(),raw=storage.getItem(key(c,id));guard(c);
    if(raw===null)return null;
    const d=JSON.parse(raw);
    if(d.version!==1||d.owner!==c.actor||d.id!==id.toLowerCase()||d.accessRevision!==c.accessRevision||!d.payload||typeof d.payload!=='object')throw Error('Rascunho inválido.');
    if(Array.isArray(d.payload))throw Error('Rascunho inválido.');
    assertJson(d.payload);
    guard(c);return d;
  }
  function save(id,payload,options={}){
    const c=session(),k=key(c,id);
    if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Conteúdo do rascunho inválido.');
    assertJson(payload);
    if(Object.prototype.hasOwnProperty.call(options,'expectedRaw')&&storage.getItem(k)!==options.expectedRaw)throw Error('O rascunho mudou em outra aba. Preserve o formulário e confira a cópia.');
    const raw=JSON.stringify({version:1,owner:c.actor,...(c.accessRevision?{accessRevision:c.accessRevision}:{}),id:id.toLowerCase(),payload});
    // Capture an immutable JSON snapshot before touching storage. Failed writes
    // must propagate so the caller keeps the original form on screen.
    const snapshot=JSON.parse(raw);
    guard(c);storage.setItem(k,raw);guard(c);
    if(storage.getItem(k)!==raw)throw Error('Não foi possível conferir o rascunho; mantenha o formulário aberto.');
    guard(c);return snapshot;
  }
  function list(){
    const c=session(),scopePrefix=prefix(c),ids=[];
    for(let i=0;i<storage.length;i++){
      const k=storage.key(i);if(k?.startsWith(scopePrefix))ids.push(k.slice(scopePrefix.length));
    }
    guard(c);
    return ids.sort().map(id=>read(id));
  }
  return Object.freeze({read,save,list});
}
return {create,PROJECT};
});
