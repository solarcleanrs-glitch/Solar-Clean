const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html', 'utf8');
const source = html.slice(html.indexOf('function cloudScopePayload('), html.indexOf('async function testCloud('));
const testUrl = 'https://zzphucuiqhzrilrddxnf.supabase.co';
let url = testUrl;
const { toCloud, fromCloud, cloudScopePayload } = new Function('cloudConfig', source + '\nreturn {toCloud,fromCloud,cloudScopePayload};')(() => ({url}));
const scopeId = '11111111-1111-4111-8111-111111111111';
const record = {cloudId: '22222222-2222-4222-8222-222222222222', createdAt:'2026-10-30T12:00:00Z', scopeId};
const remote = toCloud(record);
assert.equal(remote.sc_escopo_id, scopeId);
assert.equal(fromCloud({...remote, revision: 1}).scopeId, scopeId);
assert.equal(toCloud(fromCloud({...remote, revision: 1})).sc_escopo_id, scopeId);
for (const scopeId of [undefined, null]) {
  assert.equal(Object.hasOwn(toCloud({...record, scopeId}), 'sc_escopo_id'), false, 'legacy must never clear server scope');
}
for (const scopeId of ['', 123, {}, 'YES', '11111111-1111-4111-8111-11111111111z']) {
  assert.throws(() => toCloud({...record, scopeId}), /inválido/);
}
url = 'https://other-project.invalid';
assert.throws(() => toCloud(record), /outro projeto/);
assert.equal(Object.hasOwn(toCloud({...record, scopeId: undefined}), 'sc_escopo_id'), false);

async function testPreflightBeforeNetwork() {
  let networkCalls=0, photoCalls=0;
  const pushSource=html.slice(html.indexOf('const pendingRecordUploads=new Map();'),html.indexOf('async function pullCloud()'));
  const deps={
    ensureVistoriaSession:async()=>{}, cloudConfig:()=>({url}), cloudScopePayload,
    fetch:async()=>{networkCalls++; throw Error('must not run');},
    uploadPhotoToStorage:async()=>{photoCalls++; throw Error('must not run');},
  };
  const push = new Function(...Object.keys(deps), pushSource+'\nreturn pushRecord;')(...Object.values(deps));
  await assert.rejects(()=>push({...record,id:100,photos:[{data:'fictional'}]}), /outro projeto/);
  assert.equal(networkCalls, 0);
  assert.equal(photoCalls, 0);

  // Exercise the real form-save path: collectForm creates fresh data, but editing
  // must retain the remote linkage rather than silently returning to legacy mode.
  let stored;
  const saveSource=html.slice(html.indexOf('let generateAndSaveRunning=false;'),html.indexOf('/* ---------- Supabase Auth'));
  const saveDeps={
    editingRecord:{...record,id:100,baseRevision:2},collectForm:()=>({cliente:'Fictício'}),
    dbPut:async r=>{stored={...r};},dbAdd:async()=>{throw Error('must edit existing');},
    window:{__agendaSourceId:null},updateDashboard:async()=>{},renderHistory:async()=>{},
    renderReport:()=>{},navigator:{onLine:false},cloudReady:()=>false,
    updateSyncBadge:()=>{},alert:message=>{throw Error(message);},console,
  };
  const save=new Function(...Object.keys(saveDeps),saveSource+'\nreturn generateAndSave;')(...Object.values(saveDeps));
  await save();
  assert.equal(stored.scopeId, scopeId);
  assert.equal(stored.cloudId, record.cloudId);
  assert.equal(stored.baseRevision, 2);
  console.log('PASS: scope roundtrip, legacy compatibility and wrong-project preflight before data/photo upload');
}
testPreflightBeforeNetwork().catch(error=>{console.error(error);process.exitCode=1;});
