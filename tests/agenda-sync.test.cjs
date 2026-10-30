const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('function agendaExistingFinance('),html.indexOf('async function deleteAgendaEvent('));
const writes=html.slice(html.indexOf('function agendaPayloadMatches('),html.indexOf('function agendaLocal('));
const schema=fs.readFileSync('supabase/migrations/20261030_agenda_eventos_STAGING_NOT_APPLIED.sql','utf8');
const copy=value=>JSON.parse(JSON.stringify(value));
function harness({initial=[],online=true,responses=[]}={}){
  let stored=copy(initial);
  const calls=[];
  const deps={
    agendaLocal:()=>copy(stored),saveAgendaLocal:rows=>{stored=copy(rows);},
    cloudReady:()=>true,navigator:{onLine:online},ensureVistoriaSession:async()=>{},
    cloudConfig:()=>({url:'https://zzphucuiqhzrilrddxnf.supabase.co'}),
    cloudHeaders:extra=>extra||{},cloudScopePayload:()=>({}),ensureRecordScope:async()=>{},
    crypto:{randomUUID:()=> '11111111-1111-4111-8111-111111111111'},
    canSeeAgendaUnit:()=>true,
    fetch:async(url,options={})=>{
      calls.push({url,...options});
      const response=responses.shift();
      if(typeof response==='function')return response({stored,calls});
      if(response instanceof Error)throw response;
      if(response===undefined)throw Error('Unexpected network request');
      return {ok:true,json:async()=>response};
    },console:{warn(){}},
  };
  const helpers=new Function(...Object.keys(deps),writes+'\nreturn {writeStagingAgenda,archiveStagingAgenda,readStagingAgendaPages};')(...Object.values(deps));
  Object.assign(deps,helpers);
  const api=new Function(...Object.keys(deps),'let agendaCache=[];\n'+source+'\nreturn {agendaExistingFinance,pullAgenda,saveAgendaEvent,archiveStagingAgenda,readStagingAgendaPages,syncPendingAgenda};')(...Object.values(deps));
  return {api,calls,rows:()=>copy(stored)};
}
const event={id:'11111111-1111-4111-8111-111111111111',clientKey:'tel:synthetic',cliente:'Cliente fictício',unit:'RS',date:'2026-10-30',time:'10:00',mapsUrl:'https://maps.example.invalid/fictional'};
async function run(){
  const offline=harness({online:false});
  const pending=await offline.api.saveAgendaEvent({...event});
  assert.equal(pending.syncStatus,'pending');
  assert.equal(offline.calls.length,0);
  assert.equal(offline.rows()[0].syncStatus,'pending');

  for(const response of [[],[{}],[{id:'other'}]]){
    const denied=harness({responses:[[],response]});
    await assert.rejects(()=>denied.api.saveAgendaEvent({...event}),/não confirmado/);
    assert.equal(denied.rows()[0].syncStatus,'pending');
  }
  const success=harness({responses:[[],[{id:event.id,revision:2,updated_at:'2026-10-30T12:00:00Z'}]]});
  const saved=await success.api.saveAgendaEvent({...event});
  assert.equal(saved.syncStatus,'synced');
  assert.equal(saved.baseRevision,2);
  assert.equal(success.rows()[0].updatedAt,'2026-10-30T12:00:00Z');
  const payload=JSON.parse(success.calls[1].body);
  assert.equal(payload.maps_url,event.mapsUrl);
  for(const key of Object.keys(payload)){
    assert.match(schema,new RegExp('^\\s*'+key+'\\s+(?:uuid|text|integer|date|time|numeric|timestamptz|bigint)\\b','m'),'SQL proposal is missing wire field '+key);
  }
  const interrupted=harness({responses:[[],new Error('Offline during request')]});
  await assert.rejects(()=>interrupted.api.saveAgendaEvent({...event}),/Offline/);
  assert.equal(interrupted.rows()[0].syncStatus,'pending');

  const finance={serviceValue:12345,extraExpense:75,extraExpenseNote:'Pedágio fictício',pagamentoStatus:'Pago',pagamentoForma:'Pix',valorCobrado:12420,valorRecebido:12420};
  const edit=harness({initial:[{...event,...finance}]});
  assert.deepEqual(edit.api.agendaExistingFinance(event.id),finance);
  assert.equal(edit.api.agendaExistingFinance(null).valorRecebido,0);

  const pull=harness({initial:[
    {...event,syncStatus:'pending',cliente:'Edição pendente'},
    {...event,id:'local-only',syncStatus:'synced'},
  ],responses:[[{id:event.id,unidade:'RS',cliente:'Versão antiga da nuvem',data:event.date}],[]]});
  const rows=await pull.api.pullAgenda();
  assert.equal(rows.find(row=>row.id===event.id).cliente,'Edição pendente');
  assert.ok(rows.some(row=>row.id==='local-only'),'absence must not delete local events');
  const late=harness({responses:[[],({stored})=>{
    stored[0].updatedAt='2099-01-01T00:00:00Z';
    stored[0].cliente='Newer local edit';
    return {ok:true,json:async()=>[{id:event.id,revision:1}]};
  }]});
  await assert.rejects(()=>late.api.saveAgendaEvent({...event}),/edição mais recente/);
  assert.equal(late.rows()[0].syncStatus,'pending');
  assert.equal(late.rows()[0].cliente,'Newer local edit');
  const sameClock=harness({responses:[[],({stored})=>{
    stored[0].syncAttemptId='later-attempt';
    return {ok:true,json:async()=>[{id:event.id,revision:1}]};
  }]});
  await assert.rejects(()=>sameClock.api.saveAgendaEvent({...event}),/edição mais recente/);
  assert.equal(sameClock.rows()[0].syncStatus,'pending');
  const retry=harness({responses:[[{...payload,hora:'10:00:00',revision:1,updated_at:'2026-10-30T13:00:00Z'}]]});
  await retry.api.saveAgendaEvent({...event});
  assert.equal(retry.calls.length,1,'retry confirms identical remote create without POST');
  assert.equal(retry.rows()[0].syncStatus,'synced');
  const collision=harness({responses:[[{...payload,cliente:'Another client',revision:1}]]});
  await assert.rejects(()=>collision.api.saveAgendaEvent({...event}),/Conflito/);
  assert.equal(collision.calls.length,1);
  const patched=harness({responses:[[{id:event.id,revision:4}]]});
  await patched.api.saveAgendaEvent({...event,baseRevision:3});
  assert.equal(patched.calls[0].method,'PATCH');
  assert.match(patched.calls[0].url,/revision=eq\.3/);
  assert.doesNotMatch(patched.calls[0].url,/on_conflict/);
  const conflict=harness({responses:[[]]});
  await assert.rejects(()=>conflict.api.saveAgendaEvent({...event,baseRevision:3}),/não confirmado/);
  assert.equal(conflict.rows()[0].syncStatus,'pending');
  const recovered=harness({responses:[[],[{...payload,revision:4,hora:'10:00:00'}]]});
  const recoveredEvent=await recovered.api.saveAgendaEvent({...event,baseRevision:3});
  assert.equal(recoveredEvent.baseRevision,4);assert.equal(recoveredEvent.syncStatus,'synced');
  assert.equal(recovered.calls.length,2);assert.equal(recovered.calls[0].method,'PATCH');assert.equal(recovered.calls[1].method,undefined);
  for(const changed of [{status:'Concluído'},{valor_cobrado:500},{arquivado_em:'2026-10-30T12:00:00Z'},{revision:3}]){
    const divergent=harness({responses:[[],[{...payload,revision:4,...changed}]]});
    await assert.rejects(()=>divergent.api.saveAgendaEvent({...event,baseRevision:3}),/Conflito de revisão/);
    assert.equal(divergent.rows()[0].syncStatus,'pending');assert.equal(divergent.calls.filter(call=>call.method==='PATCH').length,1);
  }
  const archiveEvent={...event,baseRevision:3,syncStatus:'synced'};
  const archived=harness({initial:[archiveEvent],responses:[[{id:event.id,revision:4,arquivado_em:'2026-10-30T13:00:00Z'}]]});
  await archived.api.archiveStagingAgenda(archiveEvent);
  assert.equal(archived.calls[0].method,'PATCH');
  assert.equal(archived.rows()[0].archivedAt,'2026-10-30T13:00:00Z');
  assert.ok(archived.calls.every(call=>!call.url.includes('googleapis')));
  const paged=harness({responses:[[{id:'first'}],[{id:'second'}],[]]});
  assert.deepEqual((await paged.api.readStagingAgendaPages('*')).map(row=>row.id),['first','second']);
  assert.match(paged.calls[1].url,/offset=1/);
  const repeating=harness({responses:[[{id:'repeat'}],[{id:'repeat'}]]});
  await assert.rejects(()=>repeating.api.readStagingAgendaPages('*'),/repetida/);
  const queue=harness({initial:[{...event,syncStatus:'pending'},{...event,id:'already-synced',syncStatus:'synced'}],responses:[[],[{id:event.id,revision:1}]]});
  assert.deepEqual(await queue.api.syncPendingAgenda(),{synced:1,pending:0});
  assert.equal(queue.calls.length,2,'only pending event is sent');
  const queueFailure=harness({initial:[{...event,syncStatus:'pending'}],responses:[[],[]]});
  await assert.rejects(()=>queueFailure.api.syncPendingAgenda(),/continuam pendentes/);
  assert.equal(queueFailure.rows()[0].syncStatus,'pending');
  console.log('PASS: agenda offline/confirmation, edit finance, pending preservation and wire-schema compatibility (mocked API)');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
