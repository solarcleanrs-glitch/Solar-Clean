'use strict';
// Manual: requires Playwright + Chromium. All requests are fulfilled from this checkout.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const host of ['solar-clean-testes-crm.pages.dev','candidate.solar-clean-testes-crm.pages.dev']){
   const page=await browser.newPage({viewport:{width:412,height:915},serviceWorkers:'block'});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname!==host)return route.abort();
    const file=path.resolve(decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html');
    if(!file.startsWith(process.cwd()+path.sep)||!fs.existsSync(file))return route.abort();
    const type={'.js':'application/javascript','.html':'text/html','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)]||'text/plain';
    await route.fulfill({body:fs.readFileSync(file),contentType:type});
   });
   await page.goto(`https://${host}/tests/full-app-draft-sandbox.html`);
   await page.locator('#agendaBtn').click();
   assert.equal(await page.locator('#fieldAgendaScreen').isVisible(),true);
   await page.locator('#fieldAgendaUnit').selectOption('SC');
   await page.locator('#fieldAgendaLoad').click();
   await page.waitForFunction(()=>document.querySelector('#fieldAgendaStatus').textContent.includes('conecte'));
   await page.locator('#legacyAgendaFromField').click();
   assert.equal(await page.locator('#agendaScreen').isVisible(),false,'offline denial cannot open legacy data');
   await page.locator('#homeFromFieldAgenda').click();await page.locator('#agendaBtn').click();
   assert.equal(await page.locator('#fieldAgendaUnit').inputValue(),'SC');
   for(const origin of ['historyScreen','adminScreen','agendaScreen','formScreen']){
    await page.evaluate(origin=>{
     show(origin);document.querySelector('#historySearch').value='Cliente sintético';
     renderReport({cliente:'Cliente sintético',createdAt:new Date().toISOString(),photos:[]});
    },origin);
    await page.locator('#backReport').click();
    assert.equal(await page.locator('#'+(origin==='formScreen'?'historyScreen':origin)).isVisible(),true);
    assert.equal(await page.locator('#historySearch').inputValue(),'Cliente sintético');
   }
   assert.deepEqual(errors,[],'app must initialize without JavaScript errors');
   await page.close();
  }
  console.log('PASS: real Chromium mobile viewport; staging/preview entry, offline denial, preserved unit and report origin; synthetic local data only');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
