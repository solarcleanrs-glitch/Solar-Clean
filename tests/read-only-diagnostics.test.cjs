const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const files = [
  'supabase/diagnostics/inspecionar_acesso_rs_sc_parceiros_somente_leitura.sql',
  'supabase/diagnostics/inspecionar_storage_vistoria_media_somente_leitura.sql',
];
const forbidden = /\b(insert|update|delete|truncate|alter|drop|create|grant|revoke|execute|call|do|copy|vacuum|refresh|set\s+role)\b/i;
for (const file of files) {
  const sql = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const withoutComments = sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const statements = withoutComments.split(';').map(x => x.trim()).filter(Boolean);
  assert.ok(statements.length > 0, file + ': no statements');
  for (const statement of statements) {
    assert.match(statement, /^select\b/i, file + ': expected SELECT-only statement');
    assert.doesNotMatch(statement, forbidden, file + ': forbidden SQL verb');
  }
}
console.log('PASS: diagnostic scripts contain SELECT-only statements');
