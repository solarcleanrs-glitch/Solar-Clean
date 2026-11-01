'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const save=html.slice(html.indexOf('async function generateAndSave(){'),html.indexOf("$('#newBtn').onclick"));
const photo=html.slice(html.indexOf('async function addPhotosFromInput('),html.indexOf('function renderReportPhotos('));
function fixture(){let changed=false,release;const calls=[];const input={files:[{}],disabled:false,value:'a'};
const ctx={console:{warn(){}},generateAndSaveRunning:false,savedCurrentFormRecordId:null,formSessionGuard:()=>{if(changed)throw Error('Old form');},captureVistoriaOperationGuard:()=>()=>{if(changed)throw Error('Conta mudou');},editingRecord:null,collectForm:()=>({cliente:'A',photos:[]}),crypto:{randomUUID:()=> 'synthetic-cloud-id'},navigator:{onLine:false},cloudReady:()=>true,updateSyncBadge:()=>calls.push('badge'),updateDashboard:async()=>calls.push('dashboard'),renderHistory:async()=>calls.push('history'),renderReport:()=>calls.push('report'),dbAdd:()=>new Promise(r=>{release=r}),dbPut:()=>calls.push('write'),alert:()=>calls.push('alert'),photoCategories:{photoBefore:'Antes'},$:()=>input,fileToData:()=>new Promise(r=>{release=r}),renderPhotoPreview:()=>calls.push('preview'),Date,Error};ctx.window=ctx;ctx.__pendingPhotos=[];vm.createContext(ctx);vm.runInContext(save+photo,ctx);
return {ctx,calls,input,switch:()=>{changed=true},release:v=>release(v)};}
(async()=>{
let h=fixture();let p=h.ctx.generateAndSave();h.switch();h.release(1);await assert.rejects(p,/mudou/);assert.deepEqual(h.calls,[],'old saved result must not render dashboard/history/report in another account');assert.equal(h.ctx.generateAndSaveRunning,false);
h=fixture();h.switch();await assert.rejects(h.ctx.generateAndSave(),/Old form/);assert.equal(h.ctx.savedCurrentFormRecordId,null);
h=fixture();p=h.ctx.addPhotosFromInput('photoBefore');h.switch();h.release({data:'A-photo'});await assert.rejects(p,/mudou/);assert.equal(h.ctx.__pendingPhotos.length,0);assert.equal(h.input.disabled,false);assert.deepEqual(h.calls,[]);
h=fixture();p=h.ctx.generateAndSave();h.release(1);await p;assert.deepEqual(h.calls,['dashboard','history','report','badge']);assert.equal(h.ctx.savedCurrentFormRecordId,1);
assert.match(html,/currentReportSessionGuard\(\);window\.print/);
console.log('PASS: save/photo delayed results cannot render or append across accounts; old form blocked and normal offline save preserved');
})().catch(e=>{console.error(e);process.exit(1)});
