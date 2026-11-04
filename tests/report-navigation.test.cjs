'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const source=html.slice(html.indexOf("let navigationScreen="),html.indexOf('\nfunction ',html.indexOf('function returnFromReport(){')+10));
let actor='A',scroll=0;const nodes=new Map();
const screens=['home','historyScreen','adminScreen','agendaScreen','formScreen','reportScreen'];
for(const screen of screens)nodes.set('#'+screen,{hidden:screen!=='home',classList:{toggle(_,value){nodes.get('#'+screen).hidden=value;}}});
nodes.set('#historySearch',{value:'Cliente procurado'});nodes.set('#agendaDateFilter',{value:'2026-11-04'});nodes.set('#agendaUnitFilter',{value:'SC'});
const context=vm.createContext({screens,$:s=>nodes.get(s),appDraftQuarantined:false,window:{scrollY:240,scrollTo:(_,y)=>scroll=y},captureVistoriaOperationGuard:()=>{const before=actor;return()=>{if(actor!==before)throw Error('account changed');};},renderServiceContextControls:()=>{},Error});
vm.runInContext(source,context);
const run=s=>vm.runInContext(s,context);
for(const origin of ['historyScreen','adminScreen','agendaScreen']){
 run(`show('${origin}');show('reportScreen');show('reportScreen');returnFromReport()`);
 assert.equal(nodes.get('#'+origin).hidden,false);assert.equal(scroll,240);
}
assert.equal(nodes.get('#historySearch').value,'Cliente procurado');assert.equal(nodes.get('#agendaDateFilter').value,'2026-11-04');assert.equal(nodes.get('#agendaUnitFilter').value,'SC');
run("show('formScreen');show('reportScreen');returnFromReport()");assert.equal(nodes.get('#historyScreen').hidden,false);assert.equal(scroll,0);
run("show('agendaScreen');show('reportScreen')");actor='B';run('returnFromReport()');assert.equal(nodes.get('#home').hidden,false);
run('returnFromReport()');assert.equal(nodes.get('#home').hidden,false);
assert.match(html,/\$\('#backReport'\)\.onclick=returnFromReport/);
assert.match(html,/function setTech\(t\)\{\s*authSessionGeneration\+\+;\s*reportReturnContext=null;/);
console.log('PASS: report returns to its origin with filters/scroll, saved forms return to history and changed sessions return home');
