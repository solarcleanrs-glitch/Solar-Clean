'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const host of ['solar-clean-testes-crm.pages.dev','candidate.solar-clean-testes-crm.pages.dev']){
  const page=await browser.newPage({viewport:{width:412,height:915},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(seed=>{window.SCFullAppSyntheticSeed=seed;},{actors:{A:randomUUID(),B:randomUUID()},fixtureId:randomUUID(),noActivation:true,roles:{A:'gestor_unidade',B:'tecnico'}});
  await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!==host)return route.abort();const file=path.resolve(decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html');if(!file.startsWith(process.cwd()+path.sep)||!fs.existsSync(file))return route.abort();return route.fulfill({body:fs.readFileSync(file),contentType:path.extname(file)==='.js'?'application/javascript':path.extname(file)==='.html'?'text/html':'text/plain'});});
  await page.goto(`https://${host}/tests/full-app-draft-sandbox.html`);await page.waitForFunction(()=>SCOperationalAccessUI.current()?.role==='gestor_unidade');
  assert.equal(await page.locator('#newBtn').isDisabled(),false);assert.equal(await page.locator('#historyBtn').isDisabled(),false,'scoped managers use the permission-specific cache');
  await page.evaluate(()=>{setTech({name:'Regis synthetic',email:'regis@example.invalid',cloud:true});});await page.waitForFunction(()=>SCOperationalAccessUI.current()?.role==='gestor_unidade');
  const limited=await page.evaluate(()=>({sc:isRegisTech(),finance:canSeeAgendaFinance(),rs:canSeeAgendaUnit('RS'),scUnit:canSeeAgendaUnit('SC')}));
  assert.deepEqual(limited,{sc:false,finance:true,rs:true,scUnit:false});
  assert.equal(await page.locator('#serviceUnit option[value="SC"]').evaluate(o=>o.disabled),true);
  await page.evaluate(async()=>{document.querySelector('#techEmail').value='b@example.invalid';document.querySelector('#techPassword').value='synthetic';await cloudAuthLogin();});
  await page.waitForFunction(()=>SCOperationalAccessUI.current()?.role==='tecnico');
  for(const id of ['newBtn','historyBtn','crmBtn','adminBtn','legacyAgendaFromField','fieldClientsLoad'])assert.equal(await page.locator('#'+id).isDisabled(),true,id);
  assert.equal(await page.locator('#agendaBtn').isDisabled(),false);assert.equal(await page.locator('#fieldReportsLoad').isDisabled(),false);
  assert.equal(await page.locator('#fieldClientsSection').isVisible(),false);
  assert.equal(await page.evaluate(()=>canSeeAgendaFinance()),false);
  await page.evaluate(()=>{show('crmScreen');});assert.equal(await page.locator('#crmScreen').isVisible(),false);
  await page.evaluate(async()=>{const request=window.fetch;window.fetch=(url,options)=>String(url).endsWith('/sc_acesso_operacional')?Promise.resolve(new Response('Synthetic revoked',{status:403})):request(url,options);await SCOperationalAccessUI.refresh();});
  assert.equal(await page.evaluate(()=>SCOperationalAccessUI.current()),null);assert.equal(await page.locator('#agendaBtn').isDisabled(),true);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: mobile app uses server role, ignores misleading name/email, restricts units/modules and raw caches, blocks technical catalogue/finance, and closes on revoked access');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
