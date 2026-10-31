'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {read,record,readOrigins}=require('../lib/imported-clients-crm.js');
const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const row=n=>({id:id(n),cliente:'Synthetic',telefone:'+5551999991234',cidade:'Canoas',endereco:'Synthetic',unidade:'RS',origem:'nao_informada',parceiro_id:null,created_at:'2026-10-31'});
const a=record(row(1)),b=record(row(2));assert.notEqual(a.__crmKey,b.__crmKey);assert.equal(a.createdAt,'');assert.equal(a.retorno,'');assert.equal(a.dateLabel,'Sem vistoria vinculada');assert.equal(a.__standaloneClient,true);assert.equal(a.__cloudContactOnly,true);
assert.throws(()=>record({...row(1),id:'wrong'}),/incompatível/);
(async()=>{
 let actor=id(9),urls=[];const context=()=>({url:'https://zzphucuiqhzrilrddxnf.supabase.co',actor,headers:{Authorization:'Bearer synthetic'}});
 const ensureSession=async()=>{},fetcher=async url=>{urls.push(url);return {ok:true,json:async()=>url.includes('offset=0')?[row(1),row(2)]:[row(3)]};};
 const result=await read({context,ensureSession,fetcher,pageSize:2});assert.equal(result.length,3);assert.equal(urls.length,2);assert.ok(urls[1].includes('order=id.asc'));assert.ok(urls[1].includes('offset=2'));
 await assert.rejects(read({context,ensureSession,fetcher:async()=>({ok:false,status:403})}),/403/);
 await assert.rejects(read({context,ensureSession,fetcher:async()=>{actor=id(8);return {ok:true,json:async()=>[row(1)]};}}),/Conta/);
 await assert.rejects(read({context,ensureSession,pageSize:1,fetcher:async()=>({ok:true,json:async()=>[row(1)]})}),/mudou/);
 assert.deepEqual(await read({context:()=>({...context(),url:'https://other.invalid'}),ensureSession,fetcher:()=>{throw Error('must not fetch');}}),[]);
 await assert.rejects(read({context,ensureSession,fetcher,pageSize:0}),/Paginação/);
 const origin=n=>({agenda_google:'test@example.invalid',evento_google:'event-'+n,evento_original:{id:'event-'+n,summary:'Synthetic',description:'<script>untrusted</script>'}});
 const origins=await readOrigins({clientId:id(1),context,ensureSession,pageSize:1,fetcher:async url=>({ok:true,json:async()=>url.includes('offset=0')?[origin(1)]:[]})});assert.equal(origins.length,1);assert.equal(origins[0].evento_original.description,'<script>untrusted</script>');
 await assert.rejects(readOrigins({clientId:'wrong',context,ensureSession,fetcher}),/inválido/);
 await assert.rejects(readOrigins({clientId:id(1),context,ensureSession,fetcher:async()=>{actor=id(7);return {ok:true,json:async()=>[]};}}),/Conta/);
 const source=fs.readFileSync('lib/imported-clients-crm.js','utf8');assert.doesNotMatch(source,/localStorage|indexedDB|method:\s*['"](?:POST|PATCH|DELETE)/);
 // Exercise the actual CRM aggregation with an existing legacy visit sharing a phone.
 const html=fs.readFileSync('index.html','utf8'),start=html.indexOf('async function buildCrmClients()'),end=html.indexOf('function openCrmEditor(',start);
 const make=new Function('dbAll','pullStandaloneClients','pullCrmContactClientKeys','pullCrmSharedProfiles','pullCrmMeta','crmMetaCache','crmContactHistoryLocal','crmKey','standaloneClientKey','recurrenceMonths','addMonthsSafe','crmStatus','SCImportedClientsCRM','importedCrmContext','ensureVistoriaSession','fetch',html.slice(start,end)+';return buildCrmClients;');
 const key=r=>r.__crmKey||'tel:'+r.telefone.replace(/\D/g,'');
 const build=make(async()=>[{id:1,cliente:'Legacy',telefone:'+5551999991234',createdAt:'2025-01-01',retorno:'12 meses'}],async()=>[],async()=>[],async()=>[],async()=>{}, {},()=>({}),key,key,r=>r?12:null,(date,months)=>new Date('2026-01-01'),d=>({key:d?'overdue':'none',rank:d?0:3}),{read:async()=>[a,b]},context,ensureSession,fetcher);
 const clients=await build();assert.equal(clients.length,3);assert.equal(clients.filter(c=>c.last.__importedClient).length,2);for(const c of clients.filter(c=>c.last.__importedClient)){assert.equal(c.records.length,0);assert.equal(c.nextDate,null);assert.equal(c.status.key,'none');}
 assert.ok(html.includes('escapeHtml(row.evento_original.description'));
 console.log('PASS: CRM paginado sem cache, identidade UUID, sem fusão por telefone, sem vistoria/recorrência fictícia e troca de conta bloqueada');
})().catch(e=>{console.error(e);process.exitCode=1;});
