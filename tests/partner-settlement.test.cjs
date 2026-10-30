'use strict';
const assert = require('node:assert/strict');
const { buildSettlement, serviceTotal, paymentSummary } = require('../lib/partner-settlement.cjs');

const service = (id, overrides = {}) => ({
  id, partnerId: 'yes-test', unit: 'RS', status: 'completed', executedOn: '2026-10-30',
  baseCents: 10000, extras: [], ...overrides,
});
const input = {
  partnerId: 'yes-test', month: '2026-10', unit: 'RS',
  services: [
    service('yes-1', { extras: [
      { status: 'approved', unitCents: 1500, quantity: 2 },
      { status: 'pending', unitCents: 5000, quantity: 1 },
      { status: 'not_charged', unitCents: 2000, quantity: 1 },
    ], internalNote: 'never export', costCents: 9000 }),
    service('yes-2'),
    service('elysia-1', { partnerId: 'elysia-test' }),
    service('particular-1', { partnerId: null }),
    service('sc-1', { unit: 'SC' }),
    service('next-month', { executedOn: '2026-11-01' }),
    service('cancelled', { status: 'cancelled' }),
    service('history', { source: 'historico_google_agenda' }),
  ],
};
const before = JSON.stringify(input);
const draft = buildSettlement(input);
assert.equal(draft.totalCents, 23000);
assert.equal(draft.outstandingCents, 23000);
assert.equal(draft.paymentStatus, 'pending');
assert.deepEqual(draft.items.map(x => x.serviceId), ['yes-1', 'yes-2']);
assert.equal(JSON.stringify(input), before, 'must not mutate source services');
assert.equal(JSON.stringify(draft).includes('never export'), false);
assert.equal(JSON.stringify(draft).includes('costCents'), false);
assert.deepEqual(buildSettlement(input), draft, 'repeated calculation must be stable');
const receipt = { id: 'receipt-1', date: '2026-11-05', amountCents: 10000 };
const partial = buildSettlement({ ...input, receipts: [receipt] });
assert.equal(partial.paymentStatus, 'partially_paid');
assert.equal(partial.outstandingCents, 13000);
assert.equal(partial.month, '2026-10', 'receipt date must not change service competence');
assert.equal(paymentSummary(23000, [{ ...receipt, amountCents: 23000 }]).paymentStatus, 'paid');
assert.throws(() => paymentSummary(100, [{ ...receipt, amountCents: 101 }]), /excedem/);
assert.throws(() => paymentSummary(30000, [receipt, receipt]), /duplicado/);
assert.throws(() => paymentSummary(100, [{ ...receipt, amountCents: 0 }]), /maior/);
assert.throws(() => buildSettlement({ ...input, services: [service('a'), service('a')] }), /duplicado/);
for (const status of ['draft', 'sent', 'partially_paid', 'paid']) {
  assert.throws(() => buildSettlement({ ...input, existingSettlements: [{ status, serviceIds: ['yes-1'] }] }), /já vinculado/);
}
assert.equal(buildSettlement({ ...input, existingSettlements: [{ status: 'cancelled', serviceIds: ['yes-1'] }] }).totalCents, 23000);
assert.throws(() => buildSettlement({ ...input, services: [service('bad', { executedOn: '2026-02-30' })] }), /Data inválida/);
assert.throws(() => buildSettlement({ ...input, month: '2026-13' }), /Competência/);
assert.throws(() => buildSettlement({ ...input, services: [] }), /Nenhum serviço/);
for (const baseCents of [-1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
  assert.throws(() => serviceTotal(service('bad', { baseCents })), /centavos/);
}
assert.throws(() => serviceTotal(service('bad', { baseCents: Number.MAX_SAFE_INTEGER, extras: [{ status: 'approved', unitCents: 1, quantity: 1 }] })), /centavos/);
assert.throws(() => serviceTotal(service('bad', { extras: [{ status: 'approved', unitCents: 100, quantity: 0 }] })), /Quantidade/);
console.log('PASS: partner settlement calculations, separation, extras, duplicate claims and partial payments (synthetic data only)');
