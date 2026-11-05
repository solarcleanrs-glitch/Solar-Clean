'use strict';
// No tokens or client details. Journal is isolated by test project + authenticated subject.
// Use a cross-tab Web Lock supplied by the browser before any mutation.
const {sendIntent}=require('./settlement-api.cjs');
function journalKey(actor,accessRevision){
  if(!/^[0-9a-f-]{36}$/i.test(actor||''))throw new Error('Usuário autenticado inválido');
  if(accessRevision!=null&&!/^[a-f0-9]{32}$/.test(accessRevision))throw Error('Permissão financeira inválida.');
  return 'solarCleanSettlementIntent:v1:zzphucuiqhzrilrddxnf:'+actor.toLowerCase()+(accessRevision?':access:'+accessRevision:'');
}
async function executeJournaled({actor,accessRevision,intent,storage,withLock,send=sendIntent,connection,check=()=>{}}){
  const key=journalKey(actor,accessRevision);check();
  if(typeof withLock!=='function')throw new Error('Bloqueio entre abas obrigatório antes de gravar');
  const fingerprint=JSON.stringify(intent);
  return withLock(key,async()=>{
    check();
    let state=null;
    const raw=storage.getItem(key);
    if(raw){try{state=JSON.parse(raw)}catch(error){throw new Error('Operação local ilegível. Preserve o armazenamento para revisão.');}}
    if(state&&(state.actor!==actor||state.accessRevision!==accessRevision))throw new Error('Operação de outra conta ou permissão');
    if(state?.phase==='pending'&&state.fingerprint!==fingerprint)throw new Error('Há uma operação sem confirmação. Reenvie o mesmo ID antes de iniciar outra.');
    if(state?.phase==='confirmed'&&state.fingerprint===fingerprint)return state.result;
    // If durable storage fails, the network must not be touched.
    check();storage.setItem(key,JSON.stringify({actor,accessRevision,phase:'pending',fingerprint,intent}));check();
    let result;
    try{result=await send({...connection,intent});}catch(error){
      check();if(error.rejected)storage.setItem(key,JSON.stringify({actor,accessRevision,phase:'rejected',fingerprint,intent}));
      throw error;
    }
    // Keep ID + confirmed result. A crash here safely retries the same server request.
    check();storage.setItem(key,JSON.stringify({actor,accessRevision,phase:'confirmed',fingerprint,intent,result}));check();
    return result;
  });
}
function pendingIntent(storage,actor,accessRevision){
  const raw=storage.getItem(journalKey(actor,accessRevision));if(!raw)return null;
  let state;try{state=JSON.parse(raw)}catch(error){throw new Error('Operação local ilegível. Preserve para revisão.');}
  if(state.actor!==actor||state.accessRevision!==accessRevision)throw new Error('Operação de outra conta ou permissão');
  return state.phase==='pending'?state.intent:null;
}
module.exports={executeJournaled,pendingIntent,journalKey};
