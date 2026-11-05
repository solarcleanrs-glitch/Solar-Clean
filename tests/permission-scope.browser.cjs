'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
(async()=>{const browser=await chromium.launch({headless:true});try{for(const host of ['solar-clean-testes-crm.pages.dev','candidate.solar-clean-testes-crm.pages.dev']){
 const page=await browser.newPage({viewport:{width:412,height:915},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(seed=>{window.SCFullAppSyntheticSeed=seed;},{actors:{A:randomUUID(),B:randomUUID()},fixtureId:randomUUID(),noActivation:true});
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!==host)return route.abort();const file=path.resolve(decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html');if(!file.startsWith(process.cwd()+path.sep)||!fs.existsSync(file))return route.abort();return route.fulfill({body:fs.readFileSync(file),contentType:path.extname(file)==='.js'?'application/javascript':path.extname(file)==='.html'?'text/html':'text/plain'});});
 await page.goto(`https://${host}/tests/full-app-draft-sandbox.html`);await page.waitForFunction(()=>SCOperationalAccessUI.storageReady());
 const initial=await page.evaluate(async()=>{
  await dbAdd({cliente:'Synthetic SC former grant',syncStatus:'pending',serviceContext:{unit:'SC'},photos:[{data:'data:image/png;base64,cGhvdG8='}]});
  saveAgendaLocal([{id:'synthetic-SC',cliente:'Synthetic SC',unit:'SC',syncStatus:'pending'}]);
  scopedLocalSet('solarCleanCrmMeta','{"SC-private":{}}');window.__oldScopeGuard=captureVistoriaOperationGuard();
  window.google={accounts:{oauth2:{initTokenClient:options=>{window.__oldGoogleCallback=options.callback;return {requestAccessToken(){}};}}}};
  connectGoogleCalendar();googleAccessToken='synthetic-former-global-token';
  return {database:scopedLocalRuntime().capture().database,visits:JSON.stringify(await dbAll()),agenda:JSON.stringify(agendaLocal())};
 });
 await page.locator('#newBtn').click();await page.locator('#cliente').fill('Synthetic SC open draft');
 await page.evaluate(async()=>{
  const original=window.fetch;
  window.__scopeRole='gestor_unidade';window.__scopeDenied=false;
  window.fetch=async(url,o)=>{if(!String(url).endsWith('/sc_acesso_operacional'))return original(url,o);if(window.__scopeDenied)return new Response('Synthetic revoked',{status:403});const response=await original(url,o),p=await response.json();if(window.__scopeRole==='gestor_unidade'){p.role='gestor_unidade';p.units=['RS'];p.revision='2'.repeat(32);p.capabilities.access_admin=false;}return new Response(JSON.stringify(p),{status:200,headers:{'Content-Type':'application/json'}});};
  await SCOperationalAccessUI.refresh();
  window.__oldGoogleCallback({access_token:'synthetic-late-token'});
 });
 const narrow=await page.evaluate(async()=>{let oldRejected=false;try{window.__oldScopeGuard();}catch{oldRejected=true;}return {visits:await dbAll(),agenda:agendaLocal(),crm:scopedLocalGet('solarCleanCrmMeta'),drafts:getAppDraftController().list().length,form:document.querySelector('#cliente').value,oldRejected,database:scopedLocalRuntime().capture().database};});
 assert.deepEqual({...narrow,database:undefined},{visits:[],agenda:[],crm:null,drafts:0,form:'',oldRejected:true,database:undefined});assert.notEqual(narrow.database,initial.database);
 assert.equal(await page.locator('#historyBtn').isDisabled(),false);assert.equal(await page.locator('#crmBtn').isDisabled(),false);
 assert.equal(await page.evaluate(()=>googleAccessToken),'');assert.equal(await page.locator('#googleConnectBtn').isDisabled(),true);
 await page.evaluate(async()=>{await dbAdd({cliente:'Synthetic RS current grant',syncStatus:'pending',serviceContext:{unit:'RS'}});saveAgendaLocal([{id:'synthetic-RS',unit:'RS',syncStatus:'pending'}]);});
 await page.locator('#newBtn').click();await page.locator('#cliente').fill('Synthetic RS open draft');
 await page.evaluate(async()=>{window.__scopeDenied=true;await SCOperationalAccessUI.refresh();});
 assert.equal(await page.evaluate(()=>{try{scopedLocalRuntime().capture();return false;}catch{return true;}}),true);assert.equal(await page.locator('#newBtn').isDisabled(),true);
 await page.evaluate(async()=>{window.__scopeDenied=false;await SCOperationalAccessUI.refresh();});
 assert.equal(await page.evaluate(async()=>(await dbAll())[0].cliente),'Synthetic RS current grant');assert.equal(await page.evaluate(()=>getAppDraftController().list().length),1);
 await page.evaluate(async()=>{window.__scopeRole='gestor';await SCOperationalAccessUI.refresh();});
 const restored=await page.evaluate(async()=>({database:scopedLocalRuntime().capture().database,visits:JSON.stringify(await dbAll()),agenda:JSON.stringify(agendaLocal()),drafts:getAppDraftController().list().length}));
 assert.deepEqual({database:restored.database,visits:restored.visits,agenda:restored.agenda},initial);assert.equal(restored.drafts,1);assert.deepEqual(errors,[]);await page.close();
}console.log('PASS: full app same-actor RS/SC → RS → revoked → restored; old cache/photos/queues/drafts retained but unavailable under the smaller grant; scoped manager screens enabled');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
