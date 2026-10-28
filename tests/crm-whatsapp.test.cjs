const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const js=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].at(-1)?.[1];
assert.ok(js);
new vm.Script(js);
const start=js.indexOf('function normalizeWhatsappPhone(');
const end=js.indexOf('async function buildCrmClients()',start);
assert.ok(start>0&&end>start);
const helpers=new Function(js.slice(start,end)+'\nreturn {normalizeWhatsappPhone,recurrenceWhatsappMessage,whatsappLink};')();
assert.equal(helpers.normalizeWhatsappPhone('(51) 99999-8888'),'5551999998888');
assert.equal(helpers.normalizeWhatsappPhone('51999998888'),'5551999998888');
assert.equal(helpers.normalizeWhatsappPhone('abc'),'');
assert.equal(helpers.normalizeWhatsappPhone('519998877879'),'','Número com dígito extra não pode abrir WhatsApp');
assert.equal(helpers.normalizeWhatsappPhone('5133334444'),'555133334444','Telefone fixo com DDD é válido');
assert.equal(helpers.whatsappLink('','Cliente'),'');
for(const status of ['overdue','soon','ok']){
 const c={last:{cliente:'Cliente Teste',telefone:'51999998888'},status:{key:status}};
 const msg=helpers.recurrenceWhatsappMessage(c);
 const url=helpers.whatsappLink(c.last.telefone,c.last.cliente,msg);
 assert.ok(url.startsWith('https://wa.me/5551999998888?text='));
 assert.equal(decodeURIComponent(url.split('text=')[1]),msg);
 assert.ok(msg.includes('Solar Clean'));
}
assert.ok(helpers.recurrenceWhatsappMessage({last:{cliente:'Teste'},status:{key:'overdue'}}).includes('Já passou'));
assert.ok(helpers.recurrenceWhatsappMessage({last:{cliente:'Teste'},status:{key:'soon'}}).includes('Está chegando'));
const historyStart=js.indexOf('function crmContactHistoryLocal()');
const historyEnd=js.indexOf('async function pullCrmMeta()',historyStart);
assert.ok(historyStart>=0&&historyEnd>historyStart);
const store=new Map();
const localStorage={getItem:key=>store.get(key)||null,setItem:(key,val)=>store.set(key,val)};
const documentMock={innerHTML:''};
const historyHelpers=new Function('localStorage','crypto','$','escapeHtml',js.slice(historyStart,historyEnd)+'\nreturn {addCrmContactHistory,crmContactHistoryLocal,renderCrmContactHistory};')(
 localStorage,{randomUUID:()=>String(store.size+1)},()=>documentMock,s=>String(s).replaceAll('<','&lt;')
);
historyHelpers.addCrmContactHistory('cliente-1',{outcome:'Cliente respondeu',note:'Solicitou orçamento'});
historyHelpers.addCrmContactHistory('cliente-1',{outcome:'Retornar mais tarde',followup:'2026-11-05'});
assert.equal(historyHelpers.crmContactHistoryLocal()['cliente-1'].length,2);
assert.equal(historyHelpers.crmContactHistoryLocal()['cliente-1'][0].outcome,'Retornar mais tarde');
assert.equal(historyHelpers.crmContactHistoryLocal()['cliente-2'],undefined);
historyHelpers.addCrmContactHistory('cliente-2',{outcome:'Cliente respondeu',note:'Isolado'});
assert.equal(historyHelpers.crmContactHistoryLocal()['cliente-1'].length,2,'Histórico separado por cliente');
const historySyncHelpers=new Function('localStorage','crypto','$','escapeHtml','cloudReady','navigator','cloudConfig','cloudHeaders','fetch',js.slice(historyStart,historyEnd)+'\nreturn {mergeCrmContactHistory,crmContactHistoryLocal,syncCrmContactHistory};')(
  localStorage,{randomUUID:()=>String(store.size+1)},()=>documentMock,s=>s,
  ()=>false,{onLine:false},()=>({url:'https://test.invalid'}),()=>({}),async()=>{throw Error('Sem chamadas offline')}
);
const before=historySyncHelpers.crmContactHistoryLocal()['cliente-1'];
historySyncHelpers.mergeCrmContactHistory('cliente-1',[before[0],{id:'remote-one',at:'2026-10-28T15:00:00Z',outcome:'Cliente respondeu',note:'Do outro aparelho'}]);
historySyncHelpers.mergeCrmContactHistory('cliente-1',[before[0],{id:'remote-one',at:'2026-10-28T15:00:00Z',outcome:'Cliente respondeu',note:'Do outro aparelho'}]);
assert.equal(historySyncHelpers.crmContactHistoryLocal()['cliente-1'].length,3,'Mesclar duas vezes não duplica');
const headerStart=js.indexOf('function crmHistoryCloudHeaders(');
const headerEnd=js.indexOf('async function syncCrmContactHistory(',headerStart);
assert.ok(headerStart>=0&&headerEnd>headerStart);
const mockStorage={getItem:()=>''};
const unauth=new Function('localStorage','currentTech','cloudHeaders',js.slice(headerStart,headerEnd)+'\nreturn crmHistoryCloudHeaders;')(mockStorage,()=>null,()=>({}));
assert.equal(unauth(),null,'Sem login não autorizar acesso ao histórico na nuvem');
const tokenStorage={getItem:()=> 'token-auth-ficticio'};
const authed=new Function('localStorage','currentTech','cloudHeaders',js.slice(headerStart,headerEnd)+'\nreturn crmHistoryCloudHeaders;')(tokenStorage,()=>({cloud:true}),extras=>({apikey:'anon-key',Authorization:'Bearer anon-key',...extras}));
assert.equal(authed().Authorization,'Bearer token-auth-ficticio','Deve usar token do técnico e não chave anon');
assert.ok(js.includes('async function pullCrmContactClientKeys()'),'CRM consulta os IDs de clientes do histórico sem sincronizar vistorias');
assert.ok(js.includes('if(r.__crmKey)return r.__crmKey;'),'Cliente remoto mantém chave do histórico');
assert.ok(js.includes("r.__cloudContactOnly?'':whatsappLink"),'Cliente sem cadastro completo não recebe abertura de WhatsApp');
assert.ok(js.includes('async function pullCrmSharedProfiles()'),'CRM acessa perfis da nuvem');
assert.ok(js.includes("saveCrmSharedProfile(client.last)"),'CRM persiste perfis após contato');
assert.ok(js.includes("if(recent.length)"),'Último contato considera histórico recuperado');
assert.ok(js.includes("solarCleanStagingStrictVistoriaAuth"),'Modo seguro é opt-in');
assert.ok(js.includes("function vistoriaAuthToken()"),'Autenticação de vistoria separada');
assert.ok(js.includes("Sessão expirada. Entre novamente na nuvem."),'Sessão expirada é bloqueada no modo de teste');
assert.ok(js.includes("async function ensureVistoriaSession()"),'Modo de testes renova sessão da vistoria');
assert.ok(js.includes("solarCleanRefreshToken"),'Login persiste token para renovação');
assert.ok(js.includes("await ensureVistoriaSession();"),'Envios aguardam validação de sessão');
assert.ok(js.includes("profile.status==='Não contatar'"),'Bloqueio remoto tem prioridade');
assert.ok(js.includes("if(commercialStatus!==undefined)payload.status=commercialStatus"),'Abrir editor não sobrescreve status remoto');
assert.ok(js.includes("saveCrmSharedProfile(selected.last,$('#crmClientStatus').value)"),'Salvar CRM compartilha status escolhido');
console.log('PASS: sintaxe CRM, telefones, mensagens, histórico e perfis');
