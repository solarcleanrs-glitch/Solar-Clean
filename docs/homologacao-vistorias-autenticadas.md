# Plano de homologação de vistorias e mídias — Solar Clean

**Estado:** proposta, sem execução em produção. Não copiar dados reais de clientes.

## Conclusões da revisão estática
- O app faz POST/GET/DELETE na tabela `public.vistorias` por `client_uuid`.
- Campos incluídos no payload: `client_uuid`, `created_at`, `updated_at`, `cliente`, `telefone`, `cidade`, `endereco`, `pagamento_status`, `pagamento_forma`, `valor_cobrado`, `valor_recebido`, `placas`, `pot_placa`, `marca_placa`, `marca_inv`, `modelo_inv`, `ano_inst`, `telhado`, `sujeira`, `sujidades`, `estrutura`, `dps`, `qtd_dps`, `modelo_dps`, `inv_status`, `inv_internet`, `erro_inv`, `show_generation`, `antes`, `depois`, `limpeza`, `retorno`, `obs`, `pct`, `tecnico`, `tecnico_email`, `media_manifest`, `client_signature`, `signature_at`, `tech_signature`.
- Fotos são gravadas no bucket `vistoria-media`, com caminhos por UUID. O teste real precisa incluir upload e leitura autenticada.
- O modo `solarCleanStagingStrictVistoriaAuth` é experimental e desligado por padrão. Não ativar no banco principal.
- A política antiga de produção de vistorias permite `anon`; nunca copiar essa política permissiva para a homologação.

## Primeiro passo seguro: inventário do esquema (somente metadados)
Execute a consulta abaixo **somente no SQL Editor do projeto principal**, em nova query, após conferir que contém apenas SELECT. Ela não consulta linhas reais de vistorias:

```sql
SELECT column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'vistorias'
ORDER BY ordinal_position;
```

Isso nos permite preparar a tabela de homologação com tipos fiéis ao esquema existente, sem adivinhar os tipos e sem transferir dados pessoais.

## Antes de um teste real em homologação
1. Criar tabela de `vistorias` vazia, com os tipos e restrições corretos, no projeto **Solar Clean testes crm**.
2. Criar bucket **privado** `vistoria-media` apenas naquele projeto.
3. Aplicar RLS que exija sessão autenticada e vínculo do usuário de testes com `crm_usuarios` nas operações necessárias. Em Storage, aplicar políticas equivalentes a `storage.objects` restritas ao bucket de testes.
4. Avaliar separadamente as regras de SELECT, INSERT, UPDATE e DELETE e como o app faz sincronização; impedir exclusões por acidente.
5. Usar cliente, vistoria, foto e assinatura **fictícios**, em um navegador isolado e com modo experimental explicitamente ativado apenas no staging.
6. Confirmar idempotência, perda de conexão, renovação da sessão, download da foto no segundo navegador e bloqueio de usuário não autorizado.
7. Só então avaliar migração real e plano de rollback, com backup verificado.

**Bloqueio:** nenhuma alteração em produção, nenhuma execução de SQL de criação/revogação, nenhuma publicação até aprovação explícita.
