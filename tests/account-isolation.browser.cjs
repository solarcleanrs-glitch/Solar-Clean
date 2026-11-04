'use strict';
// Full application, synthetic Auth and isolated IndexedDB; all network intercepted.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{for(const host of ['solar-clean-testes-crm.pages.dev','candidate.solar-clean-testes-crm.pages.dev']){
  const page=await browser.newPage({viewport:{width:412,height:915},serviceWorkers:'block'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(seed=>{window.SCFullAppSyntheticSeed=seed;},{actors:{A:randomUUID(),B:randomUUID()},fixtureId:randomUUID(),noActivation:true});
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.hostname!==host)return route.abort();
   const file=path.resolve(decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html');
   if(!file.startsWith(process.cwd()+path.sep)||!fs.existsSync(file))return route.abort();
   return route.fulfill({body:fs.readFileSync(file),contentType:path.extname(file)==='.js'?'application/javascript':path.extname(file)==='.html'?'text/html':'text/plain'});
  });
  await page.goto(`https://${host}/tests/full-app-draft-sandbox.html`);
  const seed=await page.evaluate(async()=>{
   const mode=SCScopedLocalRuntime.MODE;
   if(localStorage.getItem(mode)!==null)throw Error('Fixture must start without activation marker');
   localStorage.setItem('solarCleanAgenda','[{"id":"legacy-unowned","cliente":"NEVER COPY"}]');
   if(agendaLocal().length)throw Error('Legacy agenda leaked');
   await dbAdd({cliente:'Synthetic owner A',cloudId:crypto.randomUUID(),createdAt:new Date().toISOString(),syncStatus:'pending',photos:[{data:'data:image/png;base64,cGhvdG8='}]});
   saveAgendaLocal([{id:crypto.randomUUID(),cliente:'Synthetic A appointment',unit:'RS',syncStatus:'pending'}]);
   scopedLocalSet('solarCleanCrmMeta','{"A-private":{}}');
   await updateDashboard();return {visits:JSON.stringify(await dbAll()),agenda:JSON.stringify(agendaLocal()),legacy:localStorage.getItem('solarCleanAgenda')};
  });
  await page.locator('#newBtn').click();await page.locator('#cliente').fill('Incomplete owner A');
  await page.evaluate(()=>{
   window.__pendingPhotos=[{name:'Synthetic photo',type:'image/png',category:'Antes',data:'data:image/png;base64,cGhvdG8='}];
   window.__agendaEditingId='old-A';window.__agendaFinanceEventId='old-A';document.querySelector('#agendaValorCobrado').value='999';
   document.querySelector('#agendaFinanceEditor').classList.remove('hidden');
   agendaCache=[{cliente:'PRIVATE A'}];window.__agendaFiltered=[{cliente:'PRIVATE A'}];
   document.querySelector('#conflictReviewRows').innerHTML='<tr><td>PRIVATE A</td></tr>';document.querySelector('#conflictReviewDetails').classList.remove('hidden');
  });
  const login=async email=>page.evaluate(async email=>{document.querySelector('#techEmail').value=email;document.querySelector('#techPassword').value='synthetic';await cloudAuthLogin();await updateDashboard();},email);
  await login('b@example.invalid');
  const B=await page.evaluate(async()=>({visits:await dbAll(),agenda:agendaLocal(),crm:scopedLocalGet('solarCleanCrmMeta'),photos:window.__pendingPhotos.length,form:document.querySelector('#cliente').value,finance:document.querySelector('#agendaValorCobrado').value,editor:window.__agendaFinanceEventId,cache:agendaCache.length,drafts:getAppDraftController().list().length}));
  assert.deepEqual(B,{visits:[],agenda:[],crm:null,photos:0,form:'',finance:'',editor:'',cache:0,drafts:0});
  assert.equal(await page.locator('#agendaFinanceEditor').isVisible(),false);
  assert.equal(await page.locator('#conflictReviewRows').textContent(),'');
  await page.evaluate(async()=>{await dbAdd({cliente:'Synthetic B',createdAt:new Date().toISOString(),syncStatus:'pending'});});
  await login('a@example.invalid');
  const A=await page.evaluate(async()=>({visits:JSON.stringify(await dbAll()),agenda:JSON.stringify(agendaLocal()),legacy:localStorage.getItem('solarCleanAgenda'),drafts:getAppDraftController().list().length}));
  assert.deepEqual({visits:A.visits,agenda:A.agenda,legacy:A.legacy},seed);assert.equal(A.drafts,1);
  await page.evaluate(()=>{const d=getAppDraftController();d.recover(d.list()[0].id);});
  assert.equal(await page.locator('#cliente').inputValue(),'Incomplete owner A');
  // Deliver the same storage notification the application receives after a
  // different tab signs out. The fixture itself never touches real storage.
  await page.evaluate(()=>{localStorage.removeItem('solarCleanAccessToken');localStorage.removeItem('solarCleanRefreshToken');localStorage.removeItem('solarCleanTech');window.dispatchEvent(new StorageEvent('storage',{key:'solarCleanAccessToken'}));});
  assert.equal(await page.locator('#cliente').inputValue(),'');
  assert.equal(await page.locator('#countPending').textContent(),'—');
  await login('a@example.invalid');
  assert.equal((await page.evaluate(()=>getAppDraftController().list().length))>=1,true);
  await page.evaluate(()=>endCloudSession());
  assert.equal(await page.locator('#newBtn').isDisabled(),true);
  assert.equal(await page.locator('#countPending').textContent(),'—');
  await page.locator('#settingsBtn').click();await page.locator('#legacyLocalInspect').click();
  await page.waitForFunction(()=>/Entre|conecte/.test(document.querySelector('#legacyLocalStatus').textContent));
  assert.equal(await page.locator('#legacyLocalExport').isDisabled(),true,'legacy cannot be read/exported without online global authorization');
  await login('a@example.invalid');
  const readonly=await page.evaluate(async()=>{
   const before=JSON.stringify(await dbAll()),name=scopedLocalRuntime().capture().database;
   // Redirect the reader to this synthetic actor's existing fixture DB. Never
   // allow the fixture to open the device's real legacy database.
   const rows=await SCLegacyLocalReview.readLegacy({open(requested){if(requested!=='solarCleanDB')throw Error('Unexpected legacy name');return indexedDB.open(name);}});
   return {equal:JSON.stringify(rows)===before,preserved:JSON.stringify(await dbAll())===before};
  });assert.deepEqual(readonly,{equal:true,preserved:true});
  assert.deepEqual(errors,[]);await page.close();
 }console.log('PASS: full app without activation marker; A/B/A queues, photos, CRM and incomplete form isolated; old finance/editor/cache cleared; legacy bytes preserved; logout locked');}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
