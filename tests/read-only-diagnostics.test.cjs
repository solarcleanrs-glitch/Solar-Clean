const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// This guard is deliberately conservative: only top-level SELECT statements
// and approved metadata sources are allowed. It is not a SQL parser.
const files = [
  'supabase/diagnostics/inventario_OFICIAL_somente_leitura.sql',
  'supabase/diagnostics/inspecionar_fechamentos_somente_leitura.sql',
  'supabase/diagnostics/inspecionar_acesso_rs_sc_parceiros_somente_leitura.sql',
  'supabase/diagnostics/inspecionar_storage_vistoria_media_somente_leitura.sql',
  'supabase/diagnostics/inspecionar_agenda_eventos_somente_leitura.sql',
];
const forbidden = /\b(insert|update|delete|truncate|alter|drop|create|grant|revoke|execute|call|do|copy|vacuum|refresh|set\s+role|into|for\s+update|for\s+share)\b/i;
const approvedSources = [
  'information_schema.columns',
  'information_schema.table_constraints',
  'information_schema.key_column_usage',
  'information_schema.constraint_column_usage',
  'information_schema.role_table_grants',
  'pg_class',
  'pg_proc',
  'pg_namespace',
  'pg_policies',
  'storage.buckets',
];
function validateStatement(statement, file) {
  assert.match(statement, /^select\b/i, file + ': expected SELECT-only statement');
  assert.doesNotMatch(statement, forbidden, file + ': forbidden SQL verb');
  assert.doesNotMatch(statement, /\b(with|union|intersect|except)\b/i, file + ': compound queries require manual review');
  assert.doesNotMatch(statement, /\b(pg_sleep|dblink|lo_export|pg_read_file|pg_write_file|pg_execute_server_program)\s*\(/i, file + ': unsafe function');
  const sources = [...statement.matchAll(/\b(?:from|join)\s+([a-z_][a-z_0-9.]*)/gi)].map(m => m[1].toLowerCase());
  assert.ok(sources.length, file + ': missing source');
  for (const source of sources) {
    assert.ok(approvedSources.includes(source), file + ': unapproved source ' + source);
  }
}
for (const unsafe of [
  'DELETE FROM storage.objects',
  'SELECT * INTO temp_snapshot FROM pg_policies',
  'SELECT * FROM public.crm_contatos',
  'SELECT * FROM pg_policies UNION SELECT * FROM public.clientes',
  'SELECT pg_sleep(3) FROM pg_policies',
  'SELECT * FROM pg_policies FOR UPDATE',
]) {
  assert.throws(() => validateStatement(unsafe, 'negative fixture'), 'Unsafe SQL accepted: ' + unsafe);
}
for (const file of files) {
  const sql = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const withoutComments = sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const statements = withoutComments.split(';').map(x => x.trim()).filter(Boolean);
  assert.ok(statements.length > 0, file + ': no statements');
  for (const statement of statements) {
    validateStatement(statement, file);
  }
}
console.log('PASS: diagnostic SQL restricted to approved metadata SELECT statements');
