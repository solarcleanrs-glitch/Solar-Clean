const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/g)];
const js = scripts.at(-1)?.[1];
assert.ok(js, 'Script principal encontrado');
new vm.Script(js, { filename: 'index-inline.js' });

function extract(start, end) {
  const a = js.indexOf(start), b = js.indexOf(end, a);
  assert.ok(a >= 0 && b > a, 'Trecho de teste encontrado: ' + start);
  return js.slice(a, b);
}
function functionFrom(source, names, values, resultName) {
  return new Function(...names, source + '\nreturn ' + resultName)(...values);
}
async function testConcurrentUploads() {
  const source = extract('const pendingRecordUploads=new Map();', 'async function pullCloud()');
  let posts=0, uuid=0;
  const deps={
    cloudConfig:()=>({url:'https://example.invalid'}),
    dbPut:async()=>{},
    uploadPhotoToStorage:async p=>p,
    toCloud:r=>({client_uuid:r.cloudId}),
    fetch:async()=>{posts++; await Promise.resolve(); return {ok:true,json:async()=>[{}]};},
    cloudHeaders:()=>({}),
    crypto:{randomUUID:()=> 'uuid-'+(++uuid)}
  };
  const push=functionFrom(source,Object.keys(deps),Object.values(deps),'pushRecord');
  const record={id:1,photos:[],syncStatus:'pending'};
  await Promise.all([push(record),push({...record})]);
  assert.equal(posts,1,'Enviar um único POST');
  assert.equal(uuid,1,'Gerar um único UUID');
}
async function testRepeatSaveAndNewForm() {
  const source = extract('let generateAndSaveRunning=false;', '/* ---------- Supabase Auth');
  let saves=0, forms=0, uuid=0;
  const alerts=[];
  const deps={
    editingRecord:null,
    collectForm:()=>{forms++;return {createdAt:'2026-10-28T13:00:00Z'};},
    dbPut:async()=>{},
    dbAdd:async()=>++saves,
    window:{__agendaSourceId:null},
    agendaLocal:()=>[],
    saveAgendaEvent:async()=>{},
    updateDashboard:async()=>{},
    renderHistory:async()=>{},
    renderReport:()=>{},
    navigator:{onLine:false},
    cloudReady:()=>false,
    pushRecord:async()=>{},
    updateSyncBadge:()=>{},
    alert:m=>alerts.push(m),
    crypto:{randomUUID:()=> 'uuid-'+(++uuid)},
    console:{warn:()=>{}}
  };
  const api=new Function(...Object.keys(deps),source + '\nreturn {save:generateAndSave,newForm:()=>{savedCurrentFormRecordId=null}}')(...Object.values(deps));
  await api.save(); await api.save();
  assert.equal(saves,1,'Segundo clique não cria outro registro');
  assert.equal(forms,1,'Segundo clique não recria formulário');
  assert.equal(alerts.length,1,'Segundo clique recebe aviso');
  api.newForm(); await api.save();
  assert.equal(saves,2,'Nova vistoria pode ser salva');
  assert.equal(uuid,2,'Vistorias novas têm IDs distintos');
}
(async()=>{await testConcurrentUploads(); await testRepeatSaveAndNewForm(); console.log('PASS: sintaxe, upload único, salvamento único e nova vistoria');})().catch(e=>{console.error(e);process.exitCode=1;});
