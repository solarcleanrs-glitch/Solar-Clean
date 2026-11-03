'use strict';
const assert=require('node:assert/strict'),api=require('../lib/field-agenda-api.js');
const row={id:'11111111-1111-4111-8111-111111111111',cliente:'Synthetic',telefone:'',cidade:'City',endereco:'Street',unidade:'RS',origem:'particular',cadastro_inicial:{secret:true},criado_por:'private'};
const ctx={url:'https://zzphucuiqhzrilrddxnf.supabase.co',check:()=>{},input:{unit:'RS',search:'Synthetic'},headers:{}};
(async()=>{
 let calls=[];
 const rows=await api.clients({...ctx,fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>calls.length===1?[row]:[]};}});
 assert.equal(rows.length,1);assert.deepEqual(Object.keys(rows[0]).sort(),['id','cliente','telefone','cidade','endereco','unidade','origem'].sort());
 assert.deepEqual(JSON.parse(calls[0].options.body),{p_unidade:'RS',p_busca:'Synthetic'});assert.match(calls[1].url,/offset=1$/);
 for(const invalid of [{...row,unidade:'SC'},{...row,id:'bad'},{...row,origem:'unknown'}])await assert.rejects(api.clients({...ctx,fetch:async()=>({ok:true,json:async()=>[invalid]})}));
 await assert.rejects(api.clients({...ctx,input:{unit:'RS',search:'x'.repeat(101)}}),/inválida/);
 let denied=0;await assert.rejects(api.clients({...ctx,fetch:async()=>{denied++;return {ok:false,status:403};}}),/recusada/);assert.equal(denied,1,'no legacy table fallback');
 let active=true;await assert.rejects(api.clients({...ctx,check:()=>{if(!active)throw Error('account changed');},fetch:async()=>({ok:true,json:async()=>{active=false;return [row];}})}),/account changed/);
 console.log('PASS: imported clients API pagination, contact-only projection, filter validation, denied access without fallback and stale result rejection');
})().catch(e=>{console.error(e);process.exit(1)});
