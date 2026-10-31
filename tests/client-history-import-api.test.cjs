'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {run}=require('../lib/client-history-import-api.js');
const actor='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
const request={rpc:'sc_importar_cliente_google',params:{p_cliente_id:id,p_agenda:'test@example.invalid',p_evento:'a',p_cadastro:{cliente:'Synthetic'},p_original:{id:'a'},p_revisado:true}};
function setup(){let current=actor,calls=[];const data=new Map();return {data,calls,request,context:()=>({url:'https://zzphucuiqhzrilrddxnf.supabase.co',actor:current,headers:{}}),change:()=>{current=other;},storage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},withLock:async(k,work)=>work(),fetcher:async(url,options)=>{calls.push(JSON.parse(options.body));return {ok:true,status:200,json:async()=>({cliente_id:JSON.parse(options.body).p_cliente_id,revision:1,repetido:false})};}};}
(async()=>{
let env=setup();await run(env);assert.equal(env.calls.length,1);assert.equal([...env.data.values()].map(JSON.parse)[0].phase,'confirmed');await run({...env,request:{...request,params:{...request.params,p_cliente_id:other}}});assert.equal(env.calls.length,1,'Reload não envia ID novo');
env=setup();await assert.rejects(run({...env,fetcher:async()=>{throw Error('offline');}}),/não confirmada/);assert.equal(JSON.parse([...env.data.values()][0]).phase,'pending');await run({...env,request:{...request,params:{...request.params,p_cliente_id:other}}});assert.equal(env.calls[0].p_cliente_id,id,'Replay usa UUID originalmente preservado');
await assert.rejects(run({...env,request:{...request,params:{...request.params,p_cadastro:{cliente:'Different'}}}}),/outros dados/);
await assert.rejects(run({...env,request:{...request,targetMode:'existing',params:{...request.params,p_cliente_id:other}}}),/outro cliente/);
env=setup();await run({...env,request:{...request,targetMode:'existing'}});await assert.rejects(run({...env,request:{...request,targetMode:'existing',params:{...request.params,p_cliente_id:other}}}),/outro cliente/);
env=setup();await assert.rejects(run({...env,storage:{getItem:()=>null,setItem:()=>{throw Error('Quota');}}}),/Quota/);assert.equal(env.calls.length,0);
env=setup();await assert.rejects(run({...env,fetcher:async()=>{env.change();return {ok:true,json:async()=>({})};}}),/Conta/);assert.equal(JSON.parse([...env.data.values()][0]).phase,'pending');
env=setup();await assert.rejects(run({...env,context:()=>({...env.context(),url:'https://other.invalid'})}),/projeto/);assert.equal(env.calls.length,0);
env=setup();await assert.rejects(run({...env,withLock:null}),/bloqueio/);assert.equal(env.calls.length,0);
env=setup();await assert.rejects(run({...env,fetcher:async()=>({ok:false,status:403,json:async()=>({message:'Denied'})})}),/403/);assert.equal(JSON.parse([...env.data.values()][0]).phase,'pending');
env=setup();await assert.rejects(run({...env,fetcher:async()=>({ok:true,json:async()=>({cliente_id:other,revision:1,repetido:true})})}),/incompatível/);
for(const file of ['google-history-review','client-history-import-plan']){const sandbox={window:{}};vm.runInNewContext(fs.readFileSync('lib/'+file+'.js','utf8'),sandbox);assert.ok(Object.keys(sandbox.window).length);}
new vm.Script(fs.readFileSync('lib/client-history-ui.js','utf8'));
console.log('PASS: fila por conta, replay do mesmo UUID, rede ambígua, quota, troca de conta e bloqueio de projeto/abas');
})().catch(e=>{console.error(e);process.exitCode=1;});
