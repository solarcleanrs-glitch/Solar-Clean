const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('let agendaOriginGeneration='),html.indexOf('function saveAgendaLocal('));
const validation=html.slice(html.indexOf('function validateServiceContext('),html.indexOf('function collectServiceContext('));
const validate=new Function(validation+'\nreturn validateServiceContext;')();
const partner='22222222-2222-4222-8222-222222222222';
const scope='11111111-1111-4111-8111-111111111111';
function harness(responses=[]){
  const nodes={};
  for(const id of ['agendaOriginWrap','agendaOriginFilterWrap','agendaOrigin','agendaOriginFilter','agendaClient','agendaUnit','serviceUnit','agendaStatusMsg'])nodes['#'+id]={value:'',textContent:'',innerHTML:'',disabled:false,classList:{toggle(){}}};
  const resetCalls=[],window={};
  const deps={
    $:selector=>nodes[selector],serviceContextEnabled:()=>true,validateServiceContext:validate,
    crypto:{randomUUID:()=>scope},navigator:{onLine:true},ensureVistoriaSession:async()=>{},
    cloudConfig:()=>({url:'https://example.invalid'}),cloudHeaders:()=>({}),
    escapeHtml:s=>String(s).replace(/[<>]/g,''),resetServiceContext:(...args)=>resetCalls.push(args),window,
    fetch:async()=>{if(!responses.length)throw Error('Unexpected request');const row=responses.shift();return {ok:true,json:async()=>row};},
  };
  const api=new Function(...Object.keys(deps),source+'\nreturn {collectAgendaContext,applyAgendaServiceContext,agendaMatchesOrigin,agendaOriginLabel,populateAgendaOrigins};')(...Object.values(deps));
  return {api,nodes,window,resetCalls};
}
async function run(){
  const {api}=harness();
  assert.throws(()=>api.collectAgendaContext(null,'RS',''),/parceiro/);
  assert.deepEqual(api.collectAgendaContext(null,'RS','particular'),{scopeId:scope,serviceContext:{unit:'RS',partnerId:null}});
  assert.equal(api.collectAgendaContext(null,'SC',partner).serviceContext.partnerId,partner);
  assert.deepEqual(api.collectAgendaContext({id:'legacy'},'RS',''),{});
  const event={id:'event',unit:'SC',scopeId:scope,serviceContext:{unit:'SC',partnerId:partner}};
  assert.equal(api.collectAgendaContext(event,'SC','particular').serviceContext.partnerId,partner,'locked origin cannot be replaced by form input');
  assert.throws(()=>api.collectAgendaContext(event,'RS',partner),/mantida/);
  assert.equal(api.agendaMatchesOrigin(event,partner),true);
  assert.equal(api.agendaMatchesOrigin(event,'YES'),false,'names must never act as foreign keys');
  assert.equal(api.agendaMatchesOrigin(event,'particular'),false);
  assert.equal(api.agendaMatchesOrigin({},'unclassified'),true);
  assert.equal(api.agendaMatchesOrigin({serviceContext:{unit:'RS',partnerId:null}},'particular'),true);
  const start=harness();
  start.api.applyAgendaServiceContext(event);
  assert.deepEqual(start.resetCalls,[[event,true]]);
  assert.equal(start.window.__agendaSourceId,event.id);
  assert.equal(start.nodes['#serviceUnit'].value,'SC');
  const partners=[{id:partner,nome:'YES fictícia',ativo:true}];
  const loaded=harness([partners]);
  await loaded.api.populateAgendaOrigins(event);
  assert.equal(loaded.nodes['#agendaOrigin'].disabled,true);
  assert.equal(loaded.nodes['#agendaUnit'].disabled,true);
  assert.equal(loaded.nodes['#agendaClient'].disabled,true);
  assert.equal(loaded.api.agendaOriginLabel(event),'YES fictícia');
  assert.equal(loaded.nodes['#agendaOrigin'].value,partner);
  const missing={id:'event',unit:'SC',scopeId:scope};
  const hydrated=harness([partners,[{id:scope,unidade:'SC',parceiro_id:partner}]]);
  await hydrated.api.populateAgendaOrigins(missing);
  assert.deepEqual(missing.serviceContext,{unit:'SC',partnerId:partner});
  const mismatch={id:'event',unit:'RS',scopeId:scope};
  const invalid=harness([partners,[{id:scope,unidade:'SC',parceiro_id:partner}]]);
  await invalid.api.populateAgendaOrigins(mismatch);
  assert.equal(mismatch.serviceContext,undefined);
  assert.match(invalid.nodes['#agendaStatusMsg'].textContent,/divergente/);
  console.log('PASS: agenda origin UUID selection/filter, linked editing and inspection context inheritance');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
