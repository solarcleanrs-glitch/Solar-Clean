const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const serializers=html.slice(html.indexOf('function cloudScopePayload('),html.indexOf('async function testCloud('));
const reconciliation=html.slice(html.indexOf('function vistoriaCreationDifferences('),html.indexOf('const pendingRecordUploads=new Map();'));
const pushSource=html.slice(html.indexOf('const pendingRecordUploads=new Map();'),html.indexOf('async function pullCloud()'));
const copy=value=>JSON.parse(JSON.stringify(value));
const uuid='11111111-1111-4111-8111-111111111111';
const fixture=()=>({id:1,cloudId:uuid,baseRevision:0,syncStatus:'pending',createdAt:'2026-10-28T12:00:00Z',cliente:'Cliente fictício',marcaPlaca:'',placas:10,valorCobrado:123.45,photos:[],clientSignature:'synthetic-signature'});
function harness(responses=[]){
  const calls=[],stored=[];
  const deps={
    cloudConfig:()=>({url:'https://zzphucuiqhzrilrddxnf.supabase.co'}),revisionProtocolEnabled:()=>true,
    cloudHeaders:()=>({}),ensureVistoriaSession:async()=>{},dbPut:async row=>stored.push(copy(row)),
    uploadPhotoToStorage:async photo=>photo,crypto:{randomUUID:()=>uuid},
    fetch:async(url,options={})=>{
      calls.push({url,...options});
      if(!responses.length)throw Error('Unexpected request');
      return responses.shift();
    }
  };
  Object.assign(deps,new Function(...Object.keys(deps),serializers+'\nreturn {toCloud,cloudScopePayload};')(...Object.values(deps)));
  Object.assign(deps,new Function(...Object.keys(deps),reconciliation+'\nreturn {confirmExistingVistoriaCreation,vistoriaCreationDifferences};')(...Object.values(deps)));
  const push=new Function(...Object.keys(deps),pushSource+'\nreturn pushRecord;')(...Object.values(deps));
  return {push,toCloud:deps.toCloud,calls,stored,differences:deps.vistoriaCreationDifferences};
}
const duplicate=()=>({ok:false,status:409,text:async()=>JSON.stringify({code:'23505',message:'duplicate key value violates unique constraint "vistorias_client_uuid_key"'})});
const ok=rows=>({ok:true,status:200,json:async()=>rows});
async function run(){
  const setup=harness(),record=fixture();
  const remote={...setup.toCloud(record),revision:3,updated_at:'2026-10-30T12:00:00Z'};
  remote.created_at='2026-10-28T09:00:00-03:00';
  remote.marca_placa=null;
  remote.valor_cobrado='123.45';
  const retry=harness([duplicate(),ok([remote])]);
  await retry.push(record);
  assert.equal(record.syncStatus,'synced');
  assert.equal(record.baseRevision,3);
  assert.equal(record.updatedAt,remote.updated_at);
  assert.equal(retry.calls[0].method,'POST');
  assert.equal(retry.calls[1].method,undefined);
  assert.ok(retry.calls.every(call=>!['PATCH','DELETE'].includes(call.method)));
  assert.equal(retry.stored.at(-1).syncStatus,'synced');

  for(const [field,value,label] of [
    ['cliente','Another client','cliente'],['valor_cobrado',999,'valor cobrado'],
    ['client_signature','other-signature','assinatura'],['media_manifest',[{storagePath:'remote/photo'}],'fotos'],
    ['sc_escopo_id','22222222-2222-4222-8222-222222222222','unidade/parceiro'],
  ]){
    const local=fixture(),conflict=harness([duplicate(),ok([{...remote,[field]:value}])]);
    await assert.rejects(()=>conflict.push(local),error=>error.message.includes(label)&&error.message.includes('preservada'));
    assert.equal(local.syncStatus,'pending');
    assert.equal(local.baseRevision,0);
    assert.equal(local.clientSignature,'synthetic-signature');
    assert.equal(conflict.calls.length,2);
  }
  for(const rows of [[],[remote,remote],[{...remote,revision:0}],[{...remote,client_uuid:'other'}]]){
    const local=fixture(),missing=harness([duplicate(),ok(rows)]);
    await assert.rejects(()=>missing.push(local),/confirmar a vistoria/);
    assert.equal(local.syncStatus,'pending');
  }
  const unuploaded=fixture();unuploaded.photos=[{name:'new',data:'synthetic'}];
  const unsent=harness([duplicate(),ok([remote])]);
  await assert.rejects(()=>unsent.push(unuploaded),/fotos/);
  assert.equal(unuploaded.syncStatus,'pending');
  const otherConflict=harness([{ok:false,status:409,text:async()=>JSON.stringify({code:'23505',message:'other_unique_constraint'})}]);
  await assert.rejects(()=>otherConflict.push(fixture()),/Envio falhou/);
  assert.equal(otherConflict.calls.length,1,'unrelated constraint must not trigger reconciliation');
  const photoRecord=fixture();photoRecord.photos=[{name:'before',type:'image/jpeg',category:'Antes',storagePath:'fixture/photo.jpg'}];
  const payload=setup.toCloud(photoRecord);
  const photoRemote={...payload,revision:1,media_manifest:[{storagePath:'fixture/photo.jpg',category:'Antes',type:'image/jpeg',name:'before'}]};
  assert.deepEqual(setup.differences(photoRecord,photoRemote,payload),[],'JSON object key order is irrelevant');
  console.log('PASS: UUID conflict recovers identical committed create; different data, signatures, photos and scopes remain pending without remote overwrite');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
