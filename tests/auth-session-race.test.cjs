'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const guard=html.slice(html.indexOf('let authSessionGeneration=0;'),html.indexOf('function setTech(t){'));
const refresh=html.slice(html.indexOf('let pendingVistoriaSessionRefresh=null;'),html.indexOf('async function syncAll(){'));
const login=html.slice(html.indexOf('async function cloudAuthLogin(){'),html.indexOf('/* ---------- Painel administrativo ---------- */'));
function setup(){const data=new Map([['solarCleanTech','A'],['solarCleanAccessToken','expired'],['solarCleanRefreshToken','refresh-A'],['offline-sentinel','keep']]),nodes={techEmail:{value:'test@example.invalid'},techPassword:{value:'secret'},techName:{value:'Teste'}};let requests=[],config={url:'https://test.invalid',key:'public'};const ctx={localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},cloudConfig:()=>config,cloudReady:()=>true,currentTech:()=>({cloud:true}),strictVistoriaAuthEnabled:()=>true,atob:()=>{throw Error('expired');},Date,JSON,Error,window:{},$:(k)=>nodes[k.slice(1)],fetch:()=>new Promise(resolve=>requests.push(resolve)),setTech:t=>{data.set('solarCleanTech',JSON.stringify(t));}};vm.createContext(ctx);vm.runInContext(guard+refresh+login,ctx);return {ctx,data,nodes,requests,config};}
const response=(a='token-new',r='refresh-new')=>({ok:true,json:async()=>({access_token:a,refresh_token:r})});
(async()=>{
 let s=setup(),p=s.ctx.ensureVistoriaSession();s.ctx.endCloudSession();s.requests[0](response());await assert.rejects(p,/sessão mudou/);assert.equal(s.data.has('solarCleanAccessToken'),false);assert.equal(s.data.has('solarCleanRefreshToken'),false);assert.equal(s.data.get('offline-sentinel'),'keep');assert.equal(s.nodes.techPassword.value,'');
 s=setup();p=s.ctx.ensureVistoriaSession();s.data.set('solarCleanAccessToken','token-B');s.data.set('solarCleanRefreshToken','refresh-B');s.data.set('solarCleanTech','B');s.requests[0](response());await assert.rejects(p,/sessão mudou/);assert.equal(s.data.get('solarCleanAccessToken'),'token-B');
 s=setup();const first=s.ctx.ensureVistoriaSession(),second=s.ctx.ensureVistoriaSession();assert.equal(s.requests.length,1);s.requests[0](response());await Promise.all([first,second]);assert.equal(s.data.get('solarCleanAccessToken'),'token-new');
 s=setup();p=s.ctx.cloudAuthLogin();s.ctx.endCloudSession();s.requests[0](response());await assert.rejects(p,/sessão mudou/);assert.equal(s.data.has('solarCleanAccessToken'),false);
 s=setup();p=s.ctx.cloudAuthLogin();s.config.url='https://other.invalid';s.requests[0](response());await assert.rejects(p,/sessão mudou/);
 s=setup();p=s.ctx.cloudAuthLogin();s.requests[0](response());await p;assert.equal(s.data.get('solarCleanRefreshToken'),'refresh-new');
 console.log('PASS: logout limpa ambos tokens sem apagar offline; refresh/login atrasados não restauram sessão nem sobrescrevem outra conta/projeto; refresh simultâneo compartilhado');
})().catch(e=>{console.error(e);process.exitCode=1;});
