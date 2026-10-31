'use strict';
const assert=require('node:assert/strict');
const {inspect,rehearse}=require('../lib/backup-recovery.js');
const actor='11111111-1111-4111-8111-111111111111';
const intent={rpc:'sc_criar_fechamento',body:{p_id:'stable-id'},expectedId:'stable-id'};
const journal={actor,phase:'pending',fingerprint:JSON.stringify(intent),intent};
const data={app:'Solar Clean Vistorias v4',exportedAt:'2026-10-31T03:00:00Z',company:{empresa:'synthetic'},vistorias:[{id:1,syncStatus:'pending',photo:'data:image/png;base64,dGVzdA==',revisionBackups:[{id:1}]}],stagingLocal:{version:1,project:'https://zzphucuiqhzrilrddxnf.supabase.co',actor,raw:{solarCleanAgenda:'[{"id":"synthetic","syncStatus":"pending"}]',solarCleanClients:'[]',solarCleanCrmMeta:'{}',solarCleanCrmContactHistory:'{}'},financialIntent:{key:'solarCleanSettlementIntent:v1:zzphucuiqhzrilrddxnf:'+actor,raw:JSON.stringify(journal)}}};
const text=JSON.stringify(data);assert.equal(inspect(text,actor).financialPhase,'pending');
assert.throws(()=>inspect(text,'22222222-2222-4222-8222-222222222222'),/mesma conta/);
for(const mutate of [d=>delete d.stagingLocal,d=>d.stagingLocal.project='https://production.example',d=>d.stagingLocal.version=2,d=>d.vistorias.push(d.vistorias[0]),d=>d.stagingLocal.raw.secret='token',d=>d.stagingLocal.financialIntent.key+='other']){
 const changed=JSON.parse(text);mutate(changed);assert.throws(()=>inspect(JSON.stringify(changed),actor));
}
const damaged=JSON.parse(text);damaged.stagingLocal.raw.solarCleanCrmMeta='broken';assert.equal(inspect(JSON.stringify(damaged),actor).warnings.length,1);
(async()=>{
 const records=new Map();let adds=0;
 const backend={async add(record){adds++;if(records.has(record.id))throw Error('duplicate');records.set(record.id,structuredClone(record));},async read(id){return structuredClone(records.get(id));}};
 const result=await rehearse({text,actor,backend,checkContext(){},id:'rehearsal-1'});
 assert.equal(result.vistorias,1);assert.equal(result.counts.solarCleanAgenda,1);assert.equal(records.get('rehearsal-1').text,text);
 assert.equal(JSON.parse(records.get('rehearsal-1').text).vistorias[0].photo,data.vistorias[0].photo);
 await assert.rejects(rehearse({text,actor,backend,checkContext(){},id:'rehearsal-1'}),/duplicate/);
 await assert.rejects(rehearse({text,actor,backend,checkContext(){throw Error('changed')},id:'no-write'}),/changed/);assert(!records.has('no-write'));
 await assert.rejects(rehearse({text,actor,backend:{add:backend.add,async read(){return {actor,text:'corrupted'}}},checkContext(){},id:'corrupt'}),/Releitura/);
 let calls=0;await assert.rejects(rehearse({text,actor,backend,checkContext(){if(++calls===2)throw Error('switched')},id:'switched'}),/switched/);assert(records.has('switched'));
 // Main application data cannot be touched: there is no storage/network API in this contract.
 const source=require('node:fs').readFileSync('lib/backup-recovery.js','utf8');assert.doesNotMatch(source,/\bfetch\s*\(|localStorage\s*\.\s*setItem|\bdbPut\s*\(|\bdbAdd\s*\(/);
 console.log('PASS: isolated recovery retains exact bytes/photos/intents, refuses wrong project/account/version and duplicates, detects read corruption/context changes, performs no operational/network writes');
})().catch(e=>{console.error(e);process.exitCode=1});
