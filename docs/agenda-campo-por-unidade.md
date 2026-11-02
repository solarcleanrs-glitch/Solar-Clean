# Consulta operacional por unidade — candidata para homologação

Implementada no banco de testes em 02/11/2026. O aplicativo ainda usa a consulta
anterior; esta etapa não ativa novos usuários nem substitui políticas existentes.

`sc_agenda_campo(p_inicio date, p_fim date, p_unidade text default null)` retorna
somente identificação operacional, contato, localização, placas, unidade,
data/horário/duração, técnico e status. Não retorna valores, pagamento,
observações internas, chave de cliente ou identificador Google. Até 93 dias
inclusive; unidade opcional RS/SC. IDs são texto, inclusive para agenda legada.

O usuário é sempre obtido de `auth.uid()`. Exige cadastro explícito ativo em
`sc_acessos` e presença em `crm_usuarios`. Gestor consulta ambas as unidades;
técnico depende da unidade autorizada e de um escopo classificado coerente;
parceiro depende também do parceiro correspondente ativo. Financeiro não recebe
acesso de campo por esta função. Registros arquivados são excluídos. Sem escopo
ou com unidade contraditória ficam visíveis apenas ao gestor.

A projeção privilegiada fica em `sc_private`, com `search_path` vazio, SQL
qualificado e autorização dentro da função. A API pública é um wrapper invoker.
Anônimo não tem EXECUTE. Não é aceito user ID ou papel como argumento.

## Verificação

`NODE_PATH=./tests/postgres/node_modules node tests/field-agenda-db.integration.cjs`

Usa PostgreSQL PGlite isolado, dados sintéticos e papéis reais: RS/SC, parceiros,
revogação imediata, unidade forjada, cadastro sem unidade, anônimo, intervalo
inválido, ausência de campos financeiros e preservação dos registros originais.
Não substitui teste de Auth HTTP ou sessão de técnico real. No Supabase de
testes também foram conferidos gestor, conta não autorizada e anônimo em
transação somente leitura com ROLLBACK, preservando registros e políticas.

`field-agenda-legacy-db.integration.cjs` executa em sequência os ensaios locais
aditivos da agenda e da fundação de acesso, cria uma associação sintética de
membro e instala a mesma projeção. Confere IDs textuais, campos nulos, valores
originais preservados e ausência de classificação automática. A associação de
membro é um pré-requisito separado, não uma migração oficial já autorizada.

## Antes da liberação

- Integrar a consulta na interface de campo e nos dados locais por conta.
- Substituir o acesso antigo às tabelas em conjunto com as políticas; manter
  acesso direto amplo permitiria contornar a projeção.
- Separar também relatório, fotos, CRM e escrita operacional. Esta consulta
  isolada não conclui a segregação do aplicativo.
- Adaptar e ensaiar a migração para a estrutura oficial; não aplicar este arquivo
  automaticamente em produção. Validar com a versão do aplicativo que fará a
  troca e preservar acesso do gestor aos registros ainda não classificados.
- Não cadastrar técnico/parceiro de campo antes de concluir o bloqueio dos
  caminhos antigos. Revisar implantação oficial com o responsável.
