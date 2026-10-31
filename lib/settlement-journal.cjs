'use strict';
// No tokens or client details. Journal is isolated by test project + authenticated subject.
// Use a cross-tab Web Lock supplied by the browser before any mutation.
const {sendIntent}=require('./settlement-api.cjs');
function journalKey(actor){
  if(!/^[0-9a-f-]{36}$/i.test(actor||''))throw new Error('Usuário autenticado inválido');
  return 'solarCleanSettlementIntent:v1:zzphucuiqhzrilrddxnf:'+actor.toLowerCase();
}
async function executeJournaled({actor,intent,storage,withLock,send=sendIntent,connection}){
  const key=journalKey(actor);
  if(typeof withLock!=='function')throw new Error('Bloqueio entre abas obrigatório antes de gravar');
  const fingerprint=JSON.stringify(intent);
  return withLock(key,async()=>{
    let state=null;
    const raw=storage.getItem(key);
    if(raw){try{state=JSON.parse(raw)}catch(error){throw new Error('Operação local ilegível. Preserve o armazenamento para revisão.');}}
    if(state&&state.actor!==actor)throw new Error('Operação de outra conta');
    if(state?.phase==='pending'&&state.fingerprint!==fingerprint)throw new Error('Há uma operação sem confirmação. Reenvie o mesmo ID antes de iniciar outra.');
    if(state?.phase==='confirmed'&&state.fingerprint===fingerprint)return state.result;
    // If durable storage fails, the network must not be touched.
    storage.setItem(key,JSON.stringify({actor,phase:'pending',fingerprint,intent}));
    let result;
    try{result=await send({...connection,intent});}catch(error){
      if(error.rejected)storage.setItem(key,JSON.stringify({actor,phase:'rejected',fingerprint,intent}));
      throw error;
    }
    // Keep ID + confirmed result. A crash here safely retries the same server request.
    storage.setItem(key,JSON.stringify({actor,phase:'confirmed',fingerprint,intent,result}));
    return result;
  });
}
function pendingIntent(storage,actor){
  const raw=storage.getItem(journalKey(actor));if(!raw)return null;
  let state;try{state=JSON.parse(raw)}catch(error){throw new Error('Operação local ilegível. Preserve para revisão.');}
  if(state.actor!==actor)throw new Error('Operação de outra conta');
  return state.phase==='pending'?state.intent:null;
}
module.exports={executeJournaled,pendingIntent,journalKey};
