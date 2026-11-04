const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Guardrails for the packaging workflow. This is static validation, not a deployment test.
const file = path.join(__dirname, '..', '.github/workflows/homologacao-pacote.yml');
const yaml = fs.readFileSync(file, 'utf8');
const lines = yaml.split(/\r?\n/);
const branch = 'feature/crm-whatsapp-recorrencia-20261028';

assert.match(yaml, /workflow_dispatch:/, 'Manual staging validation should remain available');
assert.ok(lines.some(line => line.trim() === '- ' + branch), 'Only the test branch may trigger packaging');
assert.doesNotMatch(yaml, /\b(main|master)\b/, 'Production branches must not trigger staging packaging');
assert.match(yaml, /permissions:\s*\n\s*contents:\s*read\b/, 'Workflow must use read-only repo permission');
assert.match(yaml, /actions\/upload-artifact@/, 'Staging output must be an artifact');
assert.doesNotMatch(yaml, /(?:cloudflare\/pages-action|wrangler\s+pages\s+deploy|firebase\s+deploy|vercel\s+(?:deploy|--prod)|supabase\s+db\s+(?:push|reset)|supabase\s+migration\s+up|actions\/deploy-pages)/i, 'Deployment or migration command forbidden in packaging workflow');
assert.doesNotMatch(yaml, /\b(?:secrets\.|SERVICE_ROLE_KEY|SUPABASE_DB_PASSWORD)\b/i, 'Packaging workflow must not require privileged secrets');
for (const test of [
  'crm-whatsapp.test.cjs',
  'duplicate-protection.test.cjs',
  'access-boundaries.test.cjs',
  'read-only-diagnostics.test.cjs',
  'staging-rls-risk-audit.test.cjs',
]) {
  assert.ok(yaml.includes('node tests/' + test), 'Required check missing: ' + test);
}
console.log('PASS: staging workflow remains artifact-only and isolated from production');
