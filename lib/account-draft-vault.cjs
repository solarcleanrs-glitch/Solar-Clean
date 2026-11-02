'use strict';
// Preparation only: deliberately not connected to login/logout until UI recovery
// and cross-tab coordination have been validated together.
const PROJECT='https://zzphucuiqhzrilrddxnf.supabase.co';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function create({storage,context}){
  function session(){
    const c=context();
    if(c.project!==PROJECT||!UUID.test(c.actor||''))throw Error('Conta de testes identificada obrigatória.');
    return {...c,actor:c.actor.toLowerCase()};
  }
  function guard(c){const n=session();if(n.actor!==c.actor||n.generation!==c.generation)throw Error('A conta mudou; rascunho preservado.');}
  function key(c,id){if(!UUID.test(id||''))throw Error('Identificador de rascunho inválido.');return `solarCleanDraft:v1:${c.actor}:${id.toLowerCase()}`;}
  function read(id){
    const c=session(),raw=storage.getItem(key(c,id));guard(c);
    if(raw===null)return null;
    const d=JSON.parse(raw);
    if(d.version!==1||d.owner!==c.actor||d.id!==id.toLowerCase()||!d.payload||typeof d.payload!=='object')throw Error('Rascunho inválido.');
    guard(c);return d;
  }
  function save(id,payload){
    const c=session(),k=key(c,id);
    if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Conteúdo do rascunho inválido.');
    const raw=JSON.stringify({version:1,owner:c.actor,id:id.toLowerCase(),payload});
    // Capture an immutable JSON snapshot before touching storage. Failed writes
    // must propagate so the caller keeps the original form on screen.
    const snapshot=JSON.parse(raw);
    guard(c);storage.setItem(k,raw);guard(c);
    if(storage.getItem(k)!==raw)throw Error('Não foi possível conferir o rascunho; mantenha o formulário aberto.');
    guard(c);return snapshot;
  }
  return Object.freeze({read,save});
}
module.exports={create,PROJECT};
