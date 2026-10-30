'use strict';

// Pure calculation only. No database, browser storage, pricing defaults or side effects.
// Money uses integer centavos; service dates use the local execution date (YYYY-MM-DD).
function cents(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(field + ': use centavos inteiros não negativos');
  return value;
}
function add(a, b) { return cents(a + b, 'total'); }
function required(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(field + ': obrigatório');
  return value;
}
function localDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Data inválida');
  const date = new Date(value + 'T12:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Data inválida');
  return value;
}
function serviceTotal(service) {
  let total = cents(service.baseCents, 'Preço base');
  for (const extra of service.extras || []) {
    if (!['approved', 'pending', 'not_charged'].includes(extra.status)) throw new Error('Situação do extra inválida');
    cents(extra.unitCents, 'Valor do extra');
    if (!Number.isSafeInteger(extra.quantity) || extra.quantity <= 0) throw new Error('Quantidade do extra inválida');
    if (extra.status === 'approved') total = add(total, cents(extra.unitCents * extra.quantity, 'Total do extra'));
  }
  return total;
}
function paymentSummary(totalCents, receipts) {
  cents(totalCents, 'Total');
  const ids = new Set();
  let receivedCents = 0;
  for (const receipt of receipts) {
    const id = required(receipt.id, 'ID do recebimento');
    if (ids.has(id)) throw new Error('Recebimento duplicado');
    ids.add(id);
    localDate(receipt.date);
    const amount = cents(receipt.amountCents, 'Recebimento');
    if (amount === 0) throw new Error('Recebimento deve ser maior que zero');
    receivedCents = add(receivedCents, amount);
  }
  if (receivedCents > totalCents) throw new Error('Recebimentos excedem o fechamento; conciliação necessária');
  return {
    receivedCents,
    outstandingCents: totalCents - receivedCents,
    paymentStatus: receivedCents === totalCents ? 'paid' : receivedCents > 0 ? 'partially_paid' : 'pending',
  };
}
function buildSettlement({ partnerId, month, unit, services, existingSettlements = [], receipts = [] }) {
  required(partnerId, 'Parceiro');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Competência inválida');
  if (!['RS', 'SC'].includes(unit)) throw new Error('Unidade inválida');
  const claimed = new Set();
  for (const settlement of existingSettlements) {
    if (!['draft', 'sent', 'partially_paid', 'paid', 'cancelled'].includes(settlement.status)) throw new Error('Situação do fechamento inválida');
    if (settlement.status !== 'cancelled') {
      for (const id of settlement.serviceIds) claimed.add(required(id, 'ID do serviço fechado'));
    }
  }
  const ids = new Set();
  const items = [];
  let totalCents = 0;
  for (const service of services) {
    const id = required(service.id, 'ID do serviço');
    if (ids.has(id)) throw new Error('Serviço duplicado na entrada: ' + id);
    ids.add(id);
    // An imported appointment is never treated as a completed billable service.
    if (service.partnerId !== partnerId || service.unit !== unit || service.status !== 'completed' || service.source === 'historico_google_agenda') continue;
    const date = localDate(service.executedOn);
    if (date.slice(0, 7) !== month) continue;
    if (claimed.has(id)) throw new Error('Serviço já vinculado a fechamento vigente: ' + id);
    const amountCents = serviceTotal(service);
    totalCents = add(totalCents, amountCents);
    // Explicit projection prevents internal notes, costs and contact details from leaking.
    items.push({ serviceId: id, executedOn: date, totalCents: amountCents });
  }
  if (!items.length) throw new Error('Nenhum serviço elegível para fechamento');
  items.sort((a, b) => a.executedOn.localeCompare(b.executedOn) || a.serviceId.localeCompare(b.serviceId));
  return { partnerId, month, unit, items, totalCents, ...paymentSummary(totalCents, receipts) };
}

module.exports = { serviceTotal, paymentSummary, buildSettlement };
