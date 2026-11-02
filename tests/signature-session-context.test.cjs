'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),source=html.slice(html.indexOf('function loadTechSignaturePad('),html.indexOf('/* ---------- Assinatura digital ---------- */'))+html.slice(html.indexOf('function loadSignaturePad('),html.indexOf('/* ---------- Fotos locais ---------- */'));
function fixture(){let changed=false,draws=0;const images=[],canvas={getBoundingClientRect:()=>({width:100})},ctx={signatureCanvas:()=>canvas,techSignatureCanvas:()=>canvas,signatureCtx:{drawImage:()=>draws++},techSignatureCtx:{drawImage:()=>draws++},prepareSignatureCanvas(){},prepareTechSignatureCanvas(){},clearSignaturePad(){},clearTechSignaturePad(){},captureVistoriaOperationGuard:()=>()=>{if(changed)throw Error('changed');},$:()=>({textContent:''}),Image:function(){images.push(this);}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);return {ctx,images,switch:()=>changed=true,get draws(){return draws;}};}
for(const [fn,key] of [['loadSignaturePad','__signatureData'],['loadTechSignaturePad','__techSignatureData']]){
 let h=fixture();h.ctx[fn]('synthetic-signature');h.images[0].onload();assert.equal(h.draws,1);
 h=fixture();h.ctx[fn]('synthetic-signature');h.switch();h.images[0].onload();assert.equal(h.draws,0);
 h=fixture();h.ctx[fn]('synthetic-signature');h.ctx[key]='';h.images[0].onload();assert.equal(h.draws,0);
}
console.log('PASS: client and technician signature decoders cannot repaint a changed account or a cleared signature');
