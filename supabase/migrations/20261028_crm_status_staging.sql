-- SOMENTE no projeto Solar Clean testes crm, após revisão e autorização.
-- Não executar no projeto de produção.
-- Acrescenta status compartilhado para respeitar bloqueios de contato.
ALTER TABLE public.crm_perfis
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Ativo';
ALTER TABLE public.crm_perfis
  DROP CONSTRAINT IF EXISTS crm_perfis_status_check;
ALTER TABLE public.crm_perfis
  ADD CONSTRAINT crm_perfis_status_check CHECK (status IN
    ('Ativo','Recorrência pendente','Recuperação','Inativo','Não contatar'));
-- Políticas RLS existentes permanecem ativas e inalteradas.
