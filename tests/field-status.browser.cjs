'use strict';
// Chromium + real app/API/UI modules; all HTTP and identities are synthetic.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const host of ['solar-clean-testes-crm.pages.dev','candidate.solar-clean-testes-crm.pages.dev']){
   const page=await browser.newPage({viewport:{width:412,height:915},serviceWorkers:'block'}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url());if(url.hostname!==host)return route.abort();
    const file=path.resolve(decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html');
    if(!file.startsWith(process.cwd()+path.sep)||!fs.existsSync(file))return route.abort();
    let body=fs.readFileSync(file);const ext=path.extname(file);
    if(url.pathname==='/tests/full-app-draft-sandbox.html'){
     const text=body.toString(),before="Object.defineProperty(navigator,'onLine',{value:false,configurable:false});";
     assert.ok(text.includes(before));body=text.replace(before,"Object.defineProperty(navigator,'onLine',{value:true,configurable:false});");
    }
    await route.fulfill({body,contentType:{'.js':'application/javascript','.html':'text/html','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'}[ext]||'text/plain'});
   });
   await page.goto(`https://${host}/tests/full-app-draft-sandbox.html`);
   await page.evaluate(()=>{
    const id='synthetic/field-event',next={'Agendado':'Em deslocamento','Em deslocamento':'Em atendimento','Em atendimento':'Concluído'},state={id,revision:1,status:'Agendado'},ledger=new Map(),calls=[];
    let loseResponse=true;window.__fieldStatusTest={state,ledger,calls,allowed:true};
    const current=()=>({...state,proximo_status:next[state.status]||null}),json=data=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
    const syntheticFetch=window.fetch;
    window.fetch=async(url,options={})=>{
     const endpoint=new URL(url),name=endpoint.pathname.split('/').at(-1),body=JSON.parse(options.body||'{}');
     if(name==='sc_acesso_operacional')return syntheticFetch(url,options);
     calls.push({name,body});
     if(name==='sc_agenda_campo')return json(endpoint.searchParams.get('offset')==='0'?[{id,cliente:'Atendimento sintético',data:body.p_inicio,hora:'10:00',unidade:'RS',status:state.status}]:[]);
     if(name==='sc_pode_avancar_status_campo')return json(window.__fieldStatusTest.allowed);
     if(name==='sc_agenda_status_campo')return json(current());
     if(name==='sc_avancar_status_campo'){
      if(!window.__fieldStatusTest.allowed)return new Response('denied',{status:403});
      let result=ledger.get(body.p_id);
      if(result){if(result.body!==JSON.stringify(body))return new Response('collision',{status:400});}
      else{
       if(body.p_agendamento!==id||body.p_revision!==state.revision||body.p_status!==next[state.status])return new Response('conflict',{status:400});
       state.status=body.p_status;state.revision++;result={body:JSON.stringify(body),revision:state.revision,status:state.status};ledger.set(body.p_id,result);
       if(loseResponse){loseResponse=false;throw Error('Resposta sintética perdida');}
      }
      return json({id:body.p_id,agendamento_id:id,revision:result.revision,status:result.status,repetido:true,estado_atual:current()});
     }
     return new Response('Synthetic network blocked',{status:403});
    };
   });
   await page.locator('#agendaBtn').click();await page.locator('#fieldAgendaLoad').click();
   await page.getByRole('button',{name:'Atualizar atendimento',exact:true}).click();
   await page.getByRole('button',{name:'Confirmar: Em deslocamento',exact:true}).click();
   const retry=page.getByRole('button',{name:'Repetir confirmação: Em deslocamento',exact:true});await retry.waitFor();await retry.click();
   await page.getByText('Avanço confirmado. Situação atual: Em deslocamento',{exact:true}).waitFor();
   const stats=await page.evaluate(()=>({revision:window.__fieldStatusTest.state.revision,size:window.__fieldStatusTest.ledger.size,bodies:window.__fieldStatusTest.calls.filter(c=>c.name==='sc_avancar_status_campo').map(c=>JSON.stringify(c.body))}));
   assert.equal(stats.revision,2);assert.equal(stats.size,1);assert.equal(stats.bodies.length,2);assert.equal(stats.bodies[0],stats.bodies[1]);
   await page.evaluate(()=>{window.__fieldStatusTest.allowed=false;});await page.locator('#fieldAgendaLoad').click();
   assert.equal(await page.getByRole('button',{name:'Atualizar atendimento',exact:true}).count(),0);
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS: real Chromium mobile UI confirms one step, reuses lost-response intent and hides write action when permission is denied; synthetic HTTP only');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
