const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
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
    cloudConfig:()=>({url:'https://example.invalid'}),revisionProtocolEnabled:()=>false,
    ensureVistoriaSession:async()=>{},
    dbPut:async()=>{},
    uploadPhotoToStorage:async p=>p,
    toCloud:r=>({client_uuid:r.cloudId}),
    fetch:async()=>{posts++; await Promise.resolve(); return {ok:true,json:async()=>[{client_uuid:'uuid-1'}]};},
    cloudHeaders:()=>({}),
    crypto:{randomUUID:()=> 'uuid-'+(++uuid)}
  };
  const push=functionFrom(source,Object.keys(deps),Object.values(deps),'pushRecord');
  const record={id:1,photos:[],syncStatus:'pending'};
  await Promise.all([push(record),push({...record})]);
  assert.equal(posts,1,'Enviar um único POST');
  assert.equal(uuid,1,'Gerar um único UUID');
}
async function testDeniedCloudWriteRemainsPending(){
  const source=extract('const pendingRecordUploads=new Map();', 'async function pullCloud()');
  let saved=null;
  const deps={
    cloudConfig:()=>({url:'https://example.invalid'}),revisionProtocolEnabled:()=>false,ensureVistoriaSession:async()=>{},
    dbPut:async r=>{saved={...r}},uploadPhotoToStorage:async p=>p,
    toCloud:r=>({client_uuid:r.cloudId}),
    fetch:async()=>({ok:true,json:async()=>[]}),
    cloudHeaders:()=>({}),crypto:{randomUUID:()=> 'uuid-denied'}
  };
  const push=functionFrom(source,Object.keys(deps),Object.values(deps),'pushRecord');
  const record={id:42,photos:[],syncStatus:'pending'};
  await assert.rejects(()=>push(record),/não confirmada na nuvem/);
  assert.notEqual(record.syncStatus,'synced','Resposta vazia não pode confirmar sincronização');
  assert.equal(saved.cloudId,'uuid-denied','UUID estável deve persistir para novo envio');
}
async function testInterruptedPhotoUploadResumes(){
  const source=extract('const pendingRecordUploads=new Map();', 'async function pullCloud()');
  const stored=[];
  let attempts=0;
  const deps={
    cloudConfig:()=>({url:'https://example.invalid'}),revisionProtocolEnabled:()=>false,ensureVistoriaSession:async()=>{},
    dbPut:async r=>{stored.push(JSON.parse(JSON.stringify(r)))},
    uploadPhotoToStorage:async p=>{
      if(p.storagePath)return p;
      attempts++;
      if(attempts===2)throw Error('Falha temporária na segunda foto');
      return {...p,storagePath:'uuid-photos/antes/'+p.name};
    },
    toCloud:r=>({client_uuid:r.cloudId}),
    fetch:async()=>({ok:true,json:async()=>[{client_uuid:'uuid-photos'}]}),
    cloudHeaders:()=>({}),crypto:{randomUUID:()=> 'uuid-photos'}
  };
  const push=functionFrom(source,Object.keys(deps),Object.values(deps),'pushRecord');
  const rec={id:43,photos:[{name:'a.jpg'},{name:'b.jpg'}],syncStatus:'pending'};
  await assert.rejects(()=>push(rec),/Falha temporária/);
  assert.equal(rec.photos[0].storagePath,'uuid-photos/antes/a.jpg','Primeira foto persiste após falha');
  assert.ok(stored.some(r=>r.photos?.[0]?.storagePath),'Caminho de foto deve ser salvo no banco local');
  await push(rec);
  assert.equal(attempts,3,'Reenvio não deve carregar primeira foto novamente');
  assert.equal(rec.syncStatus,'synced','Registro pode completar sincronização após recuperar');
}
async function testNewerRemoteEditStopsOverwrite(){
  const source=extract('const pendingRecordUploads=new Map();', 'async function pullCloud()');
  let posts=0;
  const deps={
    cloudConfig:()=>({url:'https://example.invalid'}),revisionProtocolEnabled:()=>false,ensureVistoriaSession:async()=>{},
    dbPut:async()=>{},uploadPhotoToStorage:async p=>p,
    toCloud:r=>({client_uuid:r.cloudId}),
    fetch:async(url,options)=>{
      if(options?.method==='POST'){posts++;return {ok:true,json:async()=>[{client_uuid:'same-id'}]};}
      return {ok:true,json:async()=>[{client_uuid:'same-id',updated_at:'2026-10-28T20:00:00Z'}]};
    },
    cloudHeaders:()=>({}),crypto:{randomUUID:()=> 'unused'}
  };
  const push=functionFrom(source,Object.keys(deps),Object.values(deps),'pushRecord');
  const record={id:51,cloudId:'same-id',updatedAt:'2026-10-28T19:00:00Z',syncStatus:'pending',photos:[]};
  await assert.rejects(()=>push(record),/Conflito/);
  assert.equal(posts,0,'Conflito detectado não sobrescreve dados remotos');
  assert.equal(record.syncStatus,'pending','Edição local permanece pendente');
}
async function testMissingRemoteBlocksOverwrite(){
  const source=extract('const pendingRecordUploads=new Map();', 'async function pullCloud()');
  let posts=0;
  const deps={
    cloudConfig:()=>({url:'https://example.invalid'}),revisionProtocolEnabled:()=>false,ensureVistoriaSession:async()=>{},
    dbPut:async()=>{},uploadPhotoToStorage:async p=>p,
    toCloud:r=>({client_uuid:r.cloudId}),cloudHeaders:()=>({}),
    fetch:async(url,options)=>{if(options?.method==='POST')posts++;return {ok:true,json:async()=>[]};},
    crypto:{randomUUID:()=> 'unused'}
  };
  const push=functionFrom(source,Object.keys(deps),Object.values(deps),'pushRecord');
  const record={id:52,cloudId:'missing-id',updatedAt:'2026-10-28T19:00:00Z',syncStatus:'pending',photos:[]};
  await assert.rejects(()=>push(record),/remota ausente ou duplicada/);
  assert.equal(posts,0,'Vistoria ausente não pode ser recriada automaticamente');
  assert.equal(record.syncStatus,'pending','Dados locais continuam pendentes');
}
async function testConditionalRevisionUpdate(){
  const source=extract('const pendingRecordUploads=new Map();', 'async function pullCloud()');
  let patched=0,posting=0;
  const deps={
    cloudConfig:()=>({url:'https://example.invalid'}),revisionProtocolEnabled:()=>true,
    ensureVistoriaSession:async()=>{},dbPut:async()=>{},
    uploadPhotoToStorage:async p=>p,toCloud:r=>({client_uuid:r.cloudId}),
    cloudHeaders:()=>({}),crypto:{randomUUID:()=> 'new-id'},
    fetch:async(url,opts)=>{
      if(opts?.method==='PATCH'){
        patched++;
        assert.ok(url.includes('revision=eq.4'),'Atualização deve exigir revisão 4');
        return {ok:true,json:async()=>[{client_uuid:'record-4',revision:5}]};
      }
      if(opts?.method==='POST')posting++;
      return {ok:true,json:async()=>[{client_uuid:'record-4',updated_at:'2026-10-28T12:00:00Z'}]};
    }
  };
  const push=functionFrom(source,Object.keys(deps),Object.values(deps),'pushRecord');
  const rec={id:71,cloudId:'record-4',baseRevision:4,updatedAt:'2026-10-28T13:00:00Z',syncStatus:'pending',photos:[]};
  await push(rec);
  assert.equal(patched,1);
  assert.equal(posting,0);
  assert.equal(rec.baseRevision,5);
  assert.equal(rec.syncStatus,'synced');
}
async function testConditionalRevisionConflict(){
  const source=extract('const pendingRecordUploads=new Map();', 'async function pullCloud()');
  let patched=0;
  const deps={
    cloudConfig:()=>({url:'https://example.invalid'}),revisionProtocolEnabled:()=>true,
    ensureVistoriaSession:async()=>{},dbPut:async()=>{},uploadPhotoToStorage:async p=>p,
    toCloud:r=>({client_uuid:r.cloudId}),cloudHeaders:()=>({}),
    crypto:{randomUUID:()=> 'new-id'},
    fetch:async(url,opts)=>{
      if(opts?.method==='PATCH'){patched++;return {ok:true,json:async()=>[]};}
      return {ok:true,json:async()=>[{client_uuid:'record-4',updated_at:'2026-10-28T12:00:00Z'}]};
    }
  };
  const push=functionFrom(source,Object.keys(deps),Object.values(deps),'pushRecord');
  const rec={id:72,cloudId:'record-4',baseRevision:4,updatedAt:'2026-10-28T13:00:00Z',syncStatus:'pending',photos:[]};
  await assert.rejects(()=>push(rec),/Conflito de revisão/);
  assert.equal(patched,1);
  assert.equal(rec.syncStatus,'pending');
  assert.equal(rec.baseRevision,4);
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
async function testRepeatedCloudPull() {
  const source=extract('async function pullCloud()', 'let syncAllRunning=false;');
  let nextId=1, adds=0;
  const locals=[];
  const cloud=[{client_uuid:'fixed-uuid',created_at:'2026-10-28T13:00:00Z',updated_at:'2026-10-28T13:00:00Z'}];
  const deps={
    cloudConfig:()=>({url:'https://example.invalid'}),revisionProtocolEnabled:()=>false,
    ensureVistoriaSession:async()=>{},
    fetch:async()=>({ok:true,json:async()=>cloud}),
    cloudHeaders:()=>({}),
    dbAll:async()=>locals.map(r=>({...r})),
    fromCloud:r=>({cloudId:r.client_uuid,createdAt:r.created_at,updatedAt:r.updated_at,syncStatus:'synced'}),
    dbAdd:async r=>{adds++;locals.push({...r,id:nextId++});},
    dbPut:async r=>{const ix=locals.findIndex(x=>x.id===r.id);if(ix>=0)locals[ix]={...r};},
    dbDelete:async id=>{const ix=locals.findIndex(x=>x.id===id);if(ix>=0)locals.splice(ix,1);}
  };
  const pull=functionFrom(source,Object.keys(deps),Object.values(deps),'pullCloud');
  await pull(); await pull(); await pull();
  assert.equal(adds,1,'Reimportar nuvem não deve duplicar vistoria');
  assert.equal(locals.length,1,'Histórico mantém um único registro pelo cloudId');
}
async function testCloudPullPreservesPendingEdit(){
  const source=extract('async function pullCloud()', 'let syncAllRunning=false;');
  const local={id:17,cloudId:'shared-id',syncStatus:'pending',cliente:'Edição local',updatedAt:'2026-10-28T12:00:00Z'};
  let writes=0;
  const deps={
    cloudConfig:()=>({url:'https://example.invalid'}),revisionProtocolEnabled:()=>false,ensureVistoriaSession:async()=>{},
    fetch:async()=>({ok:true,json:async()=>[{client_uuid:'shared-id',updated_at:'2026-10-28T19:00:00Z',cliente:'Edição remota'}]}),
    cloudHeaders:()=>({}),dbAll:async()=>[{...local}],
    fromCloud:r=>({cloudId:r.client_uuid,updatedAt:r.updated_at,cliente:r.cliente,syncStatus:'synced'}),
    dbPut:async()=>{writes++},dbAdd:async()=>{throw Error('Não deve inserir duplicata')}
  };
  const pull=functionFrom(source,Object.keys(deps),Object.values(deps),'pullCloud');
  await pull();
  assert.equal(writes,0,'Download não apaga edição local pendente');
  assert.equal(local.cliente,'Edição local');
}
async function testOfflineRecoveryWithoutDuplicate() {
  const pushSource=extract('const pendingRecordUploads=new Map();', 'async function pullCloud()');
  const pullSource=extract('async function pullCloud()', 'let syncAllRunning=false;');
  const records=[];
  const cloud=new Map([['stable-uuid',{client_uuid:'stable-uuid',updated_at:'2026-10-28T13:00:00Z'}]]);
  let nextId=1, uploads=0;
  const dbAll=async()=>records.map(r=>({...r}));
  const dbPut=async r=>{const i=records.findIndex(x=>x.id===r.id);if(i>=0)records[i]={...r};};
  const dbAdd=async r=>{const id=nextId++;records.push({...r,id});return id;};
  const dbDelete=async id=>{const i=records.findIndex(x=>x.id===id);if(i>=0)records.splice(i,1);};
  const config=()=>({url:'https://example.invalid'});
  const headers=()=>({});
  const local={cloudId:'stable-uuid',syncStatus:'pending',cliente:'TESTE ISOLADO',photos:[],createdAt:'2026-10-28T13:00:00Z',updatedAt:'2026-10-28T13:00:00Z'};
  local.id=await dbAdd(local);
  const pushDeps={
    cloudConfig:config,revisionProtocolEnabled:()=>false,ensureVistoriaSession:async()=>{},dbPut,uploadPhotoToStorage:async p=>p,
    toCloud:r=>({client_uuid:r.cloudId,created_at:r.createdAt,updated_at:r.updatedAt,cliente:r.cliente}),
    fetch:async (url,opts)=>{if(!opts?.body)return {ok:true,json:async()=>cloud.has('stable-uuid')?[cloud.get('stable-uuid')]:[]};uploads++;const row=JSON.parse(opts.body);cloud.set(row.client_uuid,row);return {ok:true,json:async()=>[row]};},
    cloudHeaders:headers,crypto:{randomUUID:()=>{throw Error('Already assigned UUID cannot be replaced')}}
  };
  const push=functionFrom(pushSource,Object.keys(pushDeps),Object.values(pushDeps),'pushRecord');
  await push(records[0]);
  const pullDeps={
    cloudConfig:config,ensureVistoriaSession:async()=>{},
    fetch:async()=>({ok:true,json:async()=>[...cloud.values()]}),
    cloudHeaders:headers,dbAll,dbPut,dbAdd,dbDelete,
    fromCloud:r=>({cloudId:r.client_uuid,createdAt:r.created_at,updatedAt:r.updated_at,cliente:r.cliente,syncStatus:'synced',photos:[]})
  };
  const pull=functionFrom(pullSource,Object.keys(pullDeps),Object.values(pullDeps),'pullCloud');
  await pull();await pull();
  assert.equal(uploads,1,'Uma vistoria offline deve enviar uma vez');
  assert.equal(records.length,1,'Baixar o mesmo serviço não deve duplicar o registro local');
  assert.equal(records[0].cloudId,'stable-uuid','ID original preservado');
}
async function testPaginatedCloudPullNeverDeletesMissingRecords(){
  const source=extract('async function pullCloud()', 'let syncAllRunning=false;');
  const locals=[{id:1,cloudId:'existing-local',syncStatus:'synced',updatedAt:'2026-10-28T13:00:00Z'}];
  let requests=0,deleted=0,added=0;
  const deps={
    cloudConfig:()=>({url:'https://example.invalid'}),revisionProtocolEnabled:()=>false,ensureVistoriaSession:async()=>{},
    fetch:async url=>{
      const offset=Number(new URL(url).searchParams.get('offset'));
      requests++;
      const page=offset===0?Array.from({length:500},(_,i)=>({client_uuid:'remote-'+i,updated_at:'2026-10-28T14:00:00Z'})):[{client_uuid:'remote-500',updated_at:'2026-10-28T14:00:00Z'}];
      return {ok:true,json:async()=>page};
    },
    cloudHeaders:()=>({}),dbAll:async()=>locals.map(x=>({...x})),
    fromCloud:r=>({cloudId:r.client_uuid,updatedAt:r.updated_at,syncStatus:'synced'}),
    dbPut:async()=>{},dbAdd:async()=>{added++;},
    dbDelete:async()=>{deleted++;}
  };
  const pull=functionFrom(source,Object.keys(deps),Object.values(deps),'pullCloud');
  await pull();
  assert.equal(requests,2,'Busca deve percorrer duas páginas');
  assert.equal(added,501,'Todas as páginas devem ser processadas');
  assert.equal(deleted,0,'A ausência na resposta não prova que o registro foi excluído');
}
async function testRemotePhotoRecovery(){
  const source=extract('async function hydrateRecordMedia(', 'function toCloud(');
  let downloaded=0,written=0;const warnings=[];
  const deps={
    downloadStorageData:async path=>{downloaded++;assert.equal(path,'record-1/antes/foto.jpg');return 'data:image/jpeg;base64,Zm9v';},
    dbPut:async()=>{written++;},alert:msg=>warnings.push(msg),console:{warn:()=>{}}
  };
  const hydrate=functionFrom(source,Object.keys(deps),Object.values(deps),'hydrateRecordMedia');
  const rec={id:8,photos:[{storagePath:'record-1/antes/foto.jpg',data:''}]};
  await hydrate(rec);await hydrate(rec);
  assert.equal(downloaded,1,'Foto remota baixa apenas uma vez e permanece em cache local');
  assert.equal(written,1,'Foto recuperada é persistida localmente');
  assert.equal(warnings.length,0,'Download bem-sucedido não gera alerta');
}
(async()=>{await testConcurrentUploads(); await testDeniedCloudWriteRemainsPending(); await testInterruptedPhotoUploadResumes(); await testNewerRemoteEditStopsOverwrite(); await testMissingRemoteBlocksOverwrite(); await testConditionalRevisionUpdate(); await testConditionalRevisionConflict(); await testRepeatSaveAndNewForm(); await testRepeatedCloudPull(); await testCloudPullPreservesPendingEdit(); await testOfflineRecoveryWithoutDuplicate(); await testPaginatedCloudPullNeverDeletesMissingRecords(); await testRemotePhotoRecovery(); console.log('PASS: sintaxe, upload único, salvamento único, nova vistoria e importação repetida');})().catch(e=>{console.error(e);process.exitCode=1;});
