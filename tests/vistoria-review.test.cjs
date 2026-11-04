const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const serialization=html.slice(html.indexOf('function cloudScopePayload('),html.indexOf('async function testCloud('));
const comparison=html.slice(html.indexOf('function vistoriaCreationDifferences('),html.indexOf('const pendingRecordUploads=new Map();'));
const reviewSource=html.slice(html.indexOf('let currentVistoriaReview='),html.indexOf('async function pullCloud()'));
const uuid='11111111-1111-4111-8111-111111111111';
function harness({remoteRevision=2,confirmChoice=true,changeDuringRead=false,revisionProtocol=true}={}){
  let local={id:1,cloudId:uuid,baseRevision:0,createdAt:'2026-10-30T12:00:00Z',cliente:'Fictício',obs:'Local <script>unsafe</script>',photos:[{storagePath:'fixture/photo.jpg',data:'synthetic-local-image'}],syncStatus:'pending'};
  const initial=structuredClone(local),nodes={};
  for(const id of ['conflictReviewStatus','conflictReviewDetails','comparePendingVistoria','conflictRecordSelect','conflictReviewRows','useLocalVistoria','useRemoteVistoria','cloudStatus'])nodes['#'+id]={value:'1',innerHTML:'',textContent:'',disabled:false,classList:{add(){},remove(){}}};
  let pushed=0,atomicWrites=0;
  const deps={
    $:selector=>nodes[selector],cloudConfig:()=>({url:'https://zzphucuiqhzrilrddxnf.supabase.co'}),cloudHeaders:()=>({}),
    ensureVistoriaSession:async()=>{},dbAll:async()=>[structuredClone(local)],
    crypto:{randomUUID:()=>uuid},escapeHtml:s=>String(s).replace(/</g,'&lt;').replace(/>/g,'&gt;'),
    confirm:()=>confirmChoice,syncAllRunning:false,pendingRecordUploads:new Map(),
    revisionProtocolEnabled:()=>revisionProtocol,
    updateDashboard:async()=>{},renderHistory:async()=>{},
    pushRecord:async record=>{pushed++;assert.equal(record.baseRevision,2);record.syncStatus='synced';local=structuredClone(record);},
    STORE:'vistorias',openDB:async()=>({transaction:()=>{
      const tx={objectStore:()=>({
        get:()=>{const request={};queueMicrotask(()=>{request.result=structuredClone(local);request.onsuccess();});return request;},
        put:record=>{atomicWrites++;local=structuredClone(record);queueMicrotask(()=>tx.oncomplete());},
      }),abort:()=>queueMicrotask(()=>tx.onabort())};return tx;
    }}),
  };
  Object.assign(deps,new Function(...Object.keys(deps),serialization+'\nreturn {toCloud,fromCloud};')(...Object.values(deps)));
  const remote={...deps.toCloud(initial),obs:'Na nuvem',revision:remoteRevision,updated_at:'2026-10-30T13:00:00Z'};
  deps.fetch=async()=>{
    if(changeDuringRead)local.obs='Changed after comparison';
    return {ok:true,json:async()=>[structuredClone(remote)]};
  };
  Object.assign(deps,new Function(...Object.keys(deps),comparison+'\nreturn {vistoriaCreationDifferences};')(...Object.values(deps)));
  const api=new Function(...Object.keys(deps),reviewSource+'\nreturn {loadVistoriaConflictReview,resolveVistoriaConflict,vistoriaReviewCell,makeVistoriaConflictChoice,setReview:value=>{currentVistoriaReview=value;},fingerprint: vistoriaReviewFingerprint};')(...Object.values(deps));
  api.setReview({localId:1,cloudId:uuid,revision:2,fingerprint:api.fingerprint(initial),fields:['obs']});
  return {api,nodes,initial,remote,state:()=>structuredClone(local),pushed:()=>pushed,writes:()=>atomicWrites,change:()=>{local.obs='Changed local';}};
}
async function run(){
  const remote=harness();await remote.api.resolveVistoriaConflict('remote');
  assert.equal(remote.state().obs,'Na nuvem');
  assert.equal(remote.state().conflictSnapshots.length,1);
  assert.equal(remote.state().conflictSnapshots[0].local.obs,remote.initial.obs);
  assert.equal(remote.state().conflictSnapshots[0].local.photos[0].data,'synthetic-local-image');
  assert.equal(remote.pushed(),0,'choosing cloud must not write to remote');
  const local=harness();await local.api.resolveVistoriaConflict('local');
  assert.equal(local.pushed(),1);
  assert.equal(local.state().obs,local.initial.obs);
  assert.equal(local.state().conflictSnapshots[0].remote.obs,'Na nuvem');
  assert.equal(local.state().conflictSnapshots[0].local.conflictSnapshots,undefined,'snapshots do not recursively duplicate backup history');
  const cancelled=harness({confirmChoice:false});await cancelled.api.resolveVistoriaConflict('local');
  assert.equal(cancelled.writes(),0);assert.equal(cancelled.pushed(),0);
  const disabled=harness({revisionProtocol:false});await disabled.api.resolveVistoriaConflict('local');
  assert.equal(disabled.writes(),0);assert.equal(disabled.pushed(),0);
  const changed=harness();changed.change();await changed.api.resolveVistoriaConflict('remote');
  assert.equal(changed.writes(),0);assert.match(changed.nodes['#conflictReviewStatus'].textContent,/local mudou/);
  const remoteChanged=harness({remoteRevision:3});await remoteChanged.api.resolveVistoriaConflict('local');
  assert.equal(remoteChanged.writes(),0);assert.equal(remoteChanged.pushed(),0);
  assert.match(remoteChanged.nodes['#conflictReviewStatus'].textContent,/nuvem mudou/);
  const raced=harness({changeDuringRead:true});await raced.api.resolveVistoriaConflict('remote');
  assert.equal(raced.writes(),0,'atomic local check prevents lost edits during network read');
  assert.equal(raced.state().obs,'Changed after comparison');
  const display=harness();await display.api.loadVistoriaConflictReview();
  assert.match(display.nodes['#conflictReviewRows'].innerHTML,/Observações/);
  assert.doesNotMatch(display.nodes['#conflictReviewRows'].innerHTML,/<script>/);
  console.log('PASS: explicit conflict choices, atomic local backup, cloud revision checks, cancellation and escaped comparisons');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
