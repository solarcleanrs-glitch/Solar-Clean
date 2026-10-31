const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Static audit only: does NOT connect to Supabase or verify live RLS.
const files = [
  'supabase/migrations/20261028_crm_contatos_staging.sql',
  'supabase/migrations/20261028_crm_perfis_staging.sql',
  'supabase/migrations/20261028_crm_metadados_staging.sql',
];
const findings = [];
for (const file of files) {
  const sql = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
    .replace(/--[^\n]*/g, '');
  const policies = sql.split(/create\s+policy\s+/i).slice(1);
  assert.ok(policies.length, file + ': no policies found');
  for (const policy of policies) {
    const name = policy.match(/^([a-z_0-9]+)/i)?.[1] || 'unknown';
    const membershipOnly = /exists\s*\(\s*select\s+1\s+from\s+public\.crm_usuarios\s+u\s+where\s+u\.user_id\s*=\s*\(\s*select\s+auth\.uid\(\)\s*\)\s*\)/i.test(policy);
    const scoped = /\b(unit_id|unidade|partner_id|parceiro_id|tenant_id)\b/i.test(policy);
    if (membershipOnly && !scoped) findings.push(file + ': ' + name);
  }
}
assert.ok(findings.length >= 3, 'Expected known cross-unit access risks to be documented');
console.warn('SECURITY BLOCKER: membership-only RLS policies without unit/partner scope:');
for (const item of findings) console.warn(' - ' + item);
console.warn('Do not deploy these policies as RS/SC or partner isolation. No database was queried.');
