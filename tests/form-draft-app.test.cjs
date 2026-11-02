'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const bridge=html.slice(html.indexOf('let appDraftController=null'),html.indexOf('function openDB(){'));
const auth=html.slice(html.indexOf('let authSessionGeneration=0;'),html.indexOf('function setTech(t){'));
const login=html.slice(html.indexOf('async function cloudAuthLogin(){'),html.indexOf('/* ---------- Painel administrativo ---------- */'));
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const token=id=>'head.'+Buffer.from(JSON.stringify({sub:id})).toString('base64url')+'.signature';
function setup(enabled=true){
 const data=new Map([['solarCleanAccessToken',token(A)],['solarCleanRefreshToken','refresh-A'],['solarCleanTech','A']]);let quota=false,next=0;
 const storage={get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem(k,v){if(quota)throw Error('quota');data.set(k,v);},removeItem:k=>data.delete(k)};
 const fields=[{tagName:'INPUT',type:'text',id:'cliente',name:'',value:'Synthetic A',checked:false},{tagName:'INPUT',type:'number',id:'valorCobrado',name:'',value:'0',checked:false}];
 const nodes=new Map(),calls=[];
 function node(id){if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',classList:{toggle(){},add(){}},appendChild(){},removeAttribute(){}});return nodes.get(id);}
 node('formScreen').querySelectorAll=()=>fields;node('techEmail').value='b@example.invalid';node('techPassword').value='synthetic';node('techName').value='B';
 const ctx={structuredClone,console,localStorage:storage,location:{hostname:'solar-clean-testes-crm.pages.dev'},document:{querySelectorAll:()=>[],createElement:()=>({})},$:s=>node(s.slice(1)),scopedLocalRuntime:()=>({enabled:()=>enabled,fingerprint:()=>String(enabled)}),cloudConfig:()=>({url:'https://zzphucuiqhzrilrddxnf.supabase.co',key:'public'}),cloudReady:()=>true,crypto:{randomUUID:()=>`cccccccc-cccc-4ccc-8ccc-${String(++next).padStart(12,'0')}`},atob:v=>Buffer.from(v,'base64').toString(),SCFormDraftAdapter:require('../lib/form-draft-adapter.js'),SCAccountDraftSession:require('../lib/account-draft-session.js'),generateAndSaveRunning:false,step:6,editingRecord:{id:9,baseRevision:4},savedCurrentFormRecordId:null,serviceContextDraft:null,serviceContextScopeId:null,serviceContextGeneration:0,currentReportRecord:{cliente:'A'},__pendingPhotos:[{data:'data:image/gif;base64,R0lG'}],__signatureData:'signature',__signatureAt:'date',__agendaSourceId:'legacy text id',__techSignatureData:'A-signature',currentTech:()=>({email:'a@example.invalid',signature:'A-signature'}),setTech:t=>data.set('solarCleanTech',JSON.stringify(t)),resetForm(){fields.forEach(n=>n.value='');ctx.savedCurrentFormRecordId=null;ctx.__signatureData='';ctx.__signatureAt='';ctx.beginAppFormDraft();},renderPhotoPreview:()=>calls.push('photos'),clearTechSignaturePad:()=>calls.push('clear-signature'),updateGenerationVisibility(){},loadSignaturePad(){},stepView(){},show:id=>calls.push(id),fetch:async()=>({ok:true,json:async()=>({access_token:token(B),refresh_token:'refresh-B'})})};ctx.window=ctx;
 vm.createContext(ctx);vm.runInContext(bridge+auth+login,ctx);
 return {ctx,data,fields,calls,quota:v=>quota=v};
}
(async()=>{
 let h=setup();h.ctx.beginAppFormDraft();h.quota(true);assert.throws(()=>h.ctx.endCloudSession(),/quota/);assert.equal(h.data.get('solarCleanAccessToken'),token(A));assert.equal(h.fields[0].value,'Synthetic A');assert.equal(h.calls.length,0);
 h.quota(false);h.ctx.endCloudSession();assert.equal(h.data.has('solarCleanAccessToken'),false);assert.equal(h.fields[0].value,'');assert.equal(h.ctx.__pendingPhotos.length,0);assert.equal(h.ctx.__techSignatureData,'');
 const key=[...h.data.keys()].find(k=>k.startsWith('solarCleanDraft:'));assert.ok(key.includes(A));const saved=JSON.parse(h.data.get(key));assert.equal(saved.payload.state.editingRecord.baseRevision,4);assert.equal(saved.payload.state.agendaSourceId,'legacy text id');
 h=setup();h.ctx.beginAppFormDraft();await h.ctx.cloudAuthLogin();assert.equal(h.data.get('solarCleanAccessToken'),token(B));assert.equal(JSON.parse(h.data.get('solarCleanTech')).signature,'','old technician signature must not enter the new account');assert.equal(h.fields[0].value,'');assert.equal(h.ctx.getAppDraftController().list().length,0);
 h.data.set('solarCleanAccessToken',token(A));const own=h.ctx.getAppDraftController().list();assert.equal(own.length,1);h.ctx.getAppDraftController().recover(own[0].id);assert.equal(h.fields[0].value,'Synthetic A');assert.equal(h.fields[1].value,'0');assert.equal(h.ctx.editingRecord.id,9);assert.equal(h.ctx.step,6);
 const recoveredCloudId=own[0].payload.state.draftCloudId;h.ctx.editingRecord=null;h.ctx.dbAll=async()=>[{cloudId:recoveredCloudId}];await assert.rejects(h.ctx.assertAppDraftSaveAllowed(),/já originou/);
 h=setup(false);h.ctx.beginAppFormDraft();h.ctx.endCloudSession();assert.equal([...h.data.keys()].some(k=>k.startsWith('solarCleanDraft:')),false);assert.equal(h.fields[0].value,'Synthetic A','inactive storage must retain the existing behavior');
 assert.ok(html.indexOf('src="lib/account-draft-session.js"')<html.indexOf('let appDraftController=null'));
 console.log('PASS: actual form/auth bridge preserves before login/logout, quota leaves tokens/form intact, clears private previews, isolates A/B/A and restores raw incomplete form; inactive behavior unchanged');
})().catch(e=>{console.error(e);process.exit(1)});
