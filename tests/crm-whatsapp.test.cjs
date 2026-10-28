const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const js=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].at(-1)?.[1];
assert.ok(js);
new vm.Script(js);
const start=js.indexOf('function normalizeWhatsappPhone(');
const end=js.indexOf('async function buildCrmClients()',start);
assert.ok(start>0&&end>start);
const helpers=new Function(js.slice(start,end)+'\nreturn {normalizeWhatsappPhone,recurrenceWhatsappMessage,whatsappLink};')();
assert.equal(helpers.normalizeWhatsappPhone('(51) 99999-8888'),'5551999998888');
assert.equal(helpers.normalizeWhatsappPhone('51999998888'),'5551999998888');
assert.equal(helpers.normalizeWhatsappPhone('abc'),'');
assert.equal(helpers.whatsappLink('','Cliente'),'');
for(const status of ['overdue','soon','ok']){
 const c={last:{cliente:'Cliente Teste',telefone:'51999998888'},status:{key:status}};
 const msg=helpers.recurrenceWhatsappMessage(c);
 const url=helpers.whatsappLink(c.last.telefone,c.last.cliente,msg);
 assert.ok(url.startsWith('https://wa.me/5551999998888?text='));
 assert.equal(decodeURIComponent(url.split('text=')[1]),msg);
 assert.ok(msg.includes('Solar Clean'));
}
assert.ok(helpers.recurrenceWhatsappMessage({last:{cliente:'Teste'},status:{key:'overdue'}}).includes('Já passou'));
assert.ok(helpers.recurrenceWhatsappMessage({last:{cliente:'Teste'},status:{key:'soon'}}).includes('Está chegando'));
console.log('PASS: sintaxe CRM, telefones, mensagens e links WhatsApp');
