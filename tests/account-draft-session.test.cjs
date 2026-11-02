'use strict';
const assert=require('node:assert/strict');
const {create}=require('../lib/account-draft-session.cjs');
const {PROJECT}=require('../lib/account-draft-vault.cjs');
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function fixture(){
 let state={project:PROJECT,actor:A,generation:1},form={cliente:'A',photos:['photo'],signature:'signature',editing:{id:9,revision:2}},quota=false,count=0;
 const data=new Map(),calls=[];
 const controller=create({storage:{getItem:k=>data.get(k)??null,setItem(k,v){if(quota)throw Error('quota');data.set(k,v);}},context:()=>state,snapshot:()=>form,clear(){calls.push('clear');form=null;},restore(v){calls.push('restore');form=v;},randomUUID:()=>`cccccccc-cccc-4ccc-8ccc-${String(++count).padStart(12,'0')}`});
 return {controller,data,calls,get form(){return form;},set form(v){form=v;},quota(v){quota=v;},switch(){calls.push('auth');state={...state,actor:B,generation:2};},back(){state={...state,actor:A,generation:3};}};
}
(async()=>{
 let h=fixture(),id=h.controller.begin();h.quota(true);
 await assert.rejects(h.controller.transition(async()=>h.switch()),/quota/);
 assert.deepEqual(h.calls,[]);assert.equal(h.form.cliente,'A');
 h.quota(false);await h.controller.transition(async()=>{assert.equal(h.data.size,1);h.switch();});
 assert.deepEqual(h.calls,['auth','clear']);assert.equal(h.form,null);
 assert.throws(()=>h.controller.recover(id),/não encontrado/);assert.equal(h.form,null);
 h.back();h.controller.recover(id);assert.equal(h.form.editing.revision,2);assert.deepEqual(h.form.photos,['photo']);
 h.form.cliente='new work';h.controller.preserve();assert.equal(h.data.size,2,'recoveries must not overwrite their source');
 h=fixture();h.controller.begin();await assert.rejects(h.controller.transition(async()=>{throw Error('login failed');}),/login failed/);
 assert.equal(h.form.cliente,'A');assert.deepEqual(h.calls,[]);assert.equal(h.data.size,1);
 h=fixture();h.controller.begin();h.switch();assert.throws(()=>h.controller.preserve(),/Volte/);assert.equal(h.data.size,0);
 h=fixture();h.controller.begin();h.quota(true);assert.throws(()=>h.controller.begin(),/quota/);assert.equal(h.form.cliente,'A');
 console.log('PASS: preserve before token changes, quota blocks transition, failed login retains form, A/B/A recovery and source copies retained');
})().catch(e=>{console.error(e);process.exit(1)});
