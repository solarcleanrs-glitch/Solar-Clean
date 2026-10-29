-- Diagnóstico SOMENTE LEITURA: execute EXCLUSIVAMENTE em "Solar Clean testes crm".
-- Não consulta objetos, fotos, clientes, URLs assinadas nem conteúdo dos arquivos.
-- Confirme o ID do projeto no painel antes de executar.
select id as bucket_id, name as bucket_name, public as is_public,
       file_size_limit, allowed_mime_types
from storage.buckets
where id = 'vistoria-media' or name = 'vistoria-media';
-- Inspecionar apenas a definição das políticas, nunca os dados.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname='storage' and tablename in ('objects','buckets')
order by tablename, policyname;
-- Mostrar somente privilégios declarados, sem identificar usuários ou arquivos.
select table_schema, table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema='storage' and table_name in ('objects','buckets')
  and grantee in ('anon','authenticated')
order by table_name, grantee, privilege_type;
