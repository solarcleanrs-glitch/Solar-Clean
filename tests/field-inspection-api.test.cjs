'use strict';
const assert=require('node:assert/strict'),api=require('../lib/field-inspection-api.js');
const visit='11111111-1111-4111-8111-111111111111',op='22222222-2222-4222-8222-222222222222',scope='33333333-3333-4333-8333-333333333333';
const p={name:'Photo',type:'image/jpeg',category:'Antes',storagePath:visit+'/campo/'+op+'/'+scope+'.jpg',data:'data:image/jpeg;base64,cGhvdG8='};
const body=api.intent({operation:op,visit,agenda:'google:synthetic/event',revision:0,data:{cliente:'Synthetic',placas:0,show_generation:false},photos:[p]});
const dto={vistoria_id:visit,scope_id:scope,revision:1,created_at:'2026-11-04T12:00:00Z',updated_at:'2026-11-04T12:00:00Z',data:{cliente:'Synthetic',placas:0,show_generation:false,obs:'PRIVATE',valor_cobrado:999},photos:[p]};
(async()=>{
 for(const data of [{obs:'attack'},{valor_cobrado:1},{placas:-1},{placas:1.5},{placas:NaN},{show_generation:null},{client_signature:'javascript:x'}])assert.throws(()=>api.intent({operation:op,visit,agenda:'event',revision:0,data}),/inválid|restrito/);
 assert.equal(api.editor(dto,visit).data.obs,undefined);assert.equal(api.editor(dto,visit).data.valor_cobrado,undefined);assert.equal(api.editor(dto,visit).data.placas,0);assert.equal(api.editor(dto,visit).data.show_generation,false);
 const calls=[];let active=true;
 const ctx={url:'https://zzphucuiqhzrilrddxnf.supabase.co',headers:{Authorization:'synthetic'},check:()=>{if(!active)throw Error('session changed');},fetch:async(url,o)=>{calls.push({url,...o});if(url.includes('/sc_preparar'))return new Response(JSON.stringify({operacao_id:op,vistoria_id:visit,confirmed:false}));if(url.includes('/storage/')){if(o.method==='POST')throw Error('lost response');return new Response(Buffer.from('photo'),{headers:{'Content-Type':'image/jpeg'}});}return new Response(JSON.stringify({operacao_id:op,vistoria_id:visit,revision:1,repetido:true,estado_atual:dto}));}};
 const result=await api.send(ctx,body,[p]);assert.equal(result.repetido,true);assert.equal(result.estado_atual.data.obs,undefined);assert.equal(calls[1].headers['x-upsert'],'false');assert.deepEqual(JSON.parse(calls[0].body),body);
 await assert.rejects(api.upload({...ctx,fetch:async(url,o)=>o.method==='POST'?new Response('',{status:409}):new Response('different')},body,p),/diferente/);
 await assert.rejects(api.prepare({...ctx,fetch:async()=>{active=false;return new Response('{}');}},body),/session changed/);active=true;
 await assert.rejects(api.send({...ctx,url:'https://official.invalid'},body,[p]),/projeto de testes/);
 const confirmedCalls=[];await api.send({...ctx,fetch:async(url,o)=>{confirmedCalls.push(url);return url.includes('/sc_preparar')?new Response(JSON.stringify({operacao_id:op,vistoria_id:visit,confirmed:true})):new Response(JSON.stringify({operacao_id:op,vistoria_id:visit,revision:1,repetido:true,estado_atual:dto}));}},body,[p]);assert.equal(confirmedCalls.some(x=>x.includes('/storage/')),false,'confirmed retry never uploads again');
 console.log('PASS: safe field intent/DTO, zero/false preserved, financial/internal fields rejected, immutable ID, upload recovery compares bytes without overwrite, confirmed retry skips uploads and stale sessions denied');
})().catch(e=>{console.error(e);process.exitCode=1;});
