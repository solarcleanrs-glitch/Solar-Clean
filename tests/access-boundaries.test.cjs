const assert = require('node:assert/strict');

// Testes puros de contrato de acesso. NÃO substituem testes reais de RLS.
const fixtures = {
  manager: { id: 'manager', role: 'admin', units: ['RS', 'SC'] },
  rs: { id: 'tech-rs', role: 'technician', units: ['RS'] },
  sc: { id: 'tech-sc', role: 'technician', units: ['SC'] },
  partnerA: { id: 'partner-a', role: 'partner', partnerId: 'A' },
  partnerB: { id: 'partner-b', role: 'partner', partnerId: 'B' },
  unknown: { id: 'unknown', role: 'none' },
};
const resources = {
  rs: { unit: 'RS', partnerId: 'A' },
  sc: { unit: 'SC', partnerId: 'B' },
};
// Contrato desejado, não implementação de autorização de produção.
function expectedAccess(user, resource, operation) {
  if (user.role === 'admin') return true;
  if (user.role === 'technician') {
    return user.units.includes(resource.unit) && !['finance', 'internal-note'].includes(operation);
  }
  if (user.role === 'partner') {
    return user.partnerId === resource.partnerId && ['read-schedule', 'read-report', 'create-own-client'].includes(operation);
  }
  return false;
}
const cases = [
  ['U01 gestor RS', fixtures.manager, resources.rs, 'read-schedule', true],
  ['U01 gestor SC', fixtures.manager, resources.sc, 'read-schedule', true],
  ['U02 técnico RS não lê SC', fixtures.rs, resources.sc, 'read-schedule', false],
  ['U03 técnico SC não lê RS', fixtures.sc, resources.rs, 'read-schedule', false],
  ['U04 técnico RS não altera SC', fixtures.rs, resources.sc, 'write-inspection', false],
  ['U05 desconhecido não lê', fixtures.unknown, resources.rs, 'read-report', false],
  ['P01 parceiro A cria próprio cliente', fixtures.partnerA, resources.rs, 'create-own-client', true],
  ['P02 parceiro A não lê B', fixtures.partnerA, resources.sc, 'read-schedule', false],
  ['P03 parceiro A não lê relatório B', fixtures.partnerA, resources.sc, 'read-report', false],
  ['P04 parceiro A lê horário próprio', fixtures.partnerA, resources.rs, 'read-schedule', true],
  ['P05 parceiro A não altera financeiro', fixtures.partnerA, resources.rs, 'finance', false],
  ['P05 parceiro A não lê nota interna', fixtures.partnerA, resources.rs, 'internal-note', false],
];
for (const [name, user, resource, operation, allowed] of cases) {
  assert.equal(expectedAccess(user, resource, operation), allowed, name);
}
console.log('PASS: 12 cenários de contrato de acesso (somente simulação; RLS não validada)');
