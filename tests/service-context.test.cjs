const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('let serviceContextDraft='),html.indexOf("$('#serviceContextRefresh').onclick="));
const staging='https://zzphucuiqhzrilrddxnf.supabase.co';
const scopeId='11111111-1111-4111-8111-111111111111';
const partnerId='22222222-2222-4222-8222-222222222222';
function harness({responses=[],editingRecord=null,offline=false}={}){
  const nodes={};
  for(const key of ['serviceContextPanel','serviceUnit','serviceOrigin','serviceContextStatus'])nodes['#'+key]={value:'',textContent:'',innerHTML:'',disabled:false,classList:{toggle(){}}};
  const calls=[];
  let generatedIds=0;
  const deps={
    $:selector=>nodes[selector],cloudConfig:()=>({url:staging}),editingRecord,
    crypto:{randomUUID:()=>{generatedIds++;return scopeId;}},navigator:{onLine:!offline},
    ensureVistoriaSession:async()=>{},crmHistoryCloudHeaders:extra=>({'Authorization':'Bearer synthetic',...extra}),
    cloudScopePayload:()=>({}),crmKey:()=> 'tel:synthetic',escapeHtml:s=>String(s).replace(/[<>]/g,''),
    fetch:async(url,options={})=>{
      calls.push({url,...options});
      if(!responses.length)throw Error('Unexpected request');
      const next=responses.shift();
      if(next instanceof Error)throw next;
      return {ok:true,json:async()=>next};
    },
  };
  const api=new Function(...Object.keys(deps),source+'\nreturn {collectServiceContext,resetServiceContext,renderServiceContextControls,ensureRecordScope,validateServiceContext};')(...Object.values(deps));
  return {api,nodes,calls,generatedIds:()=>generatedIds};
}
async function run(){
  const fresh=harness();
  assert.throws(()=>fresh.api.collectServiceContext(),/unidade/);
  fresh.nodes['#serviceUnit'].value='SC';
  assert.throws(()=>fresh.api.collectServiceContext(),/parceiro/);
  fresh.nodes['#serviceOrigin'].value='particular';
  assert.deepEqual(fresh.api.collectServiceContext(),{scopeId,serviceContext:{unit:'SC',partnerId:null}});
  fresh.nodes['#serviceOrigin'].value=partnerId;
  assert.equal(fresh.api.collectServiceContext().serviceContext.partnerId,partnerId);
  fresh.api.resetServiceContext();
  assert.equal(fresh.nodes['#serviceUnit'].value,'');
  const legacy=harness({editingRecord:{id:1}});
  assert.deepEqual(legacy.api.collectServiceContext(),{});
  legacy.api.resetServiceContext({scopeId},true);
  assert.deepEqual(legacy.api.collectServiceContext(),{scopeId},'linked edit preserves identity even without metadata');
  assert.equal(legacy.generatedIds(),0);
  legacy.api.resetServiceContext({scopeId,serviceContext:{unit:'RS',partnerId:null}},false);
  legacy.nodes['#serviceOrigin'].value='particular';
  assert.equal(legacy.api.collectServiceContext().scopeId,scopeId);
  assert.equal(legacy.generatedIds(),1,'reuse requests a fresh scope ID instead of linking to the old service');
  legacy.nodes['#serviceOrigin'].value='';
  assert.throws(()=>legacy.api.collectServiceContext(),/parceiro/);

  const row={id:scopeId,unidade:'SC',parceiro_id:partnerId};
  const newRecord={scopeId,serviceContext:{unit:'SC',partnerId}};
  const create=harness({responses:[[],[],[row]]});
  await create.api.ensureRecordScope(newRecord);
  assert.equal(create.calls.length,3);
  assert.equal(create.calls[1].method,'POST');
  assert.match(create.calls[1].headers.Prefer,/ignore-duplicates/);
  assert.deepEqual(JSON.parse(create.calls[1].body),{id:scopeId,unidade:'SC',parceiro_id:partnerId,legacy_client_key:'tel:synthetic'});
  const retry=harness({responses:[[row]]});
  await retry.api.ensureRecordScope(newRecord);
  assert.equal(retry.calls.length,1,'confirmed existing scope does not POST again');
  const conflict=harness({responses:[[{...row,unidade:'RS'}]]});
  await assert.rejects(()=>conflict.api.ensureRecordScope(newRecord),/diferente/);
  assert.equal(conflict.calls.length,1,'never overwrite conflicting scope');
  const missing=harness({responses:[[]]});
  await assert.rejects(()=>missing.api.ensureRecordScope({scopeId}),/unidade/);
  assert.equal(missing.calls.length,1,'no context must not recreate missing scope');
  const emptyResponse=harness({responses:[[],[],[]]});
  await assert.rejects(()=>emptyResponse.api.ensureRecordScope(newRecord),/não confirmada/);
  const interrupted=harness({responses:[[],new Error('Network interrupted')]});
  await assert.rejects(()=>interrupted.api.ensureRecordScope(newRecord),/Network interrupted/);
  assert.equal(newRecord.scopeId,scopeId);

  const catalog=harness({responses:[[
    {id:partnerId,nome:'YES fictícia',ativo:true},
    {id:'33333333-3333-4333-8333-333333333333',nome:'Inativo fictício',ativo:false},
  ]]});
  await catalog.api.renderServiceContextControls();
  assert.match(catalog.nodes['#serviceOrigin'].innerHTML,/YES fictícia/);
  assert.doesNotMatch(catalog.nodes['#serviceOrigin'].innerHTML,/Inativo fictício/);
  const locked=harness({responses:[[],[{...row,parceiro_id:null}]]});
  locked.api.resetServiceContext({scopeId},true);
  await locked.api.renderServiceContextControls();
  assert.equal(locked.nodes['#serviceUnit'].disabled,true);
  assert.equal(locked.nodes['#serviceOrigin'].disabled,true);
  assert.equal(locked.api.collectServiceContext().serviceContext.unit,'SC');
  const offline=harness({offline:true});
  await offline.api.renderServiceContextControls();
  assert.match(offline.nodes['#serviceContextStatus'].textContent,/Sem conexão/);
  assert.equal(offline.calls.length,0);
  const stale=harness({responses:[[]]});
  const rendering=stale.api.renderServiceContextControls();
  stale.api.resetServiceContext();
  stale.nodes['#serviceContextStatus'].textContent='New form';
  await rendering;
  assert.equal(stale.nodes['#serviceContextStatus'].textContent,'New form','old async response must not overwrite a new form');
  console.log('PASS: explicit service context, legacy editing, scope retries/conflicts, catalog and offline controls');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
