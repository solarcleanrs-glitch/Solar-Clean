# Avanço do atendimento por acesso — testes

## Comportamento

Na agenda por acesso, gestor e técnico ativos com vínculo em `crm_usuarios`
podem consultar a situação atual e confirmar um único avanço:
Agendado → Em deslocamento → Em atendimento → Concluído.
Técnico depende também de unidade autorizada e escopo coerente no atendimento.
Parceiro e financeiro permanecem sem escrita. Gestor mantém acesso aos registros
ainda sem classificação; técnico não recebe essa exceção.

O servidor confere a revisão e registra a tentativa por UUID, autor e conteúdo.
Repetir exatamente a mesma tentativa devolve a confirmação anterior e a situação
atual, sem outro avanço. Alteração concorrente exige nova consulta; não há salto,
retrocesso, cancelamento ou mudança de valores por essa operação.

A interface só oferece a ação após consultar a permissão. Consulta a revisão
atual antes da confirmação, mantém a mesma tentativa após resposta incerta e
descarta respostas após mudança de conta/filtro. A tentativa fica em memória;
após recarregar, consultar a situação atual antes de confirmar outro avanço.
Não há fila offline nova para esta ação.

## Segurança e implantação de testes

Migração `20261104192519_field_agenda_status_staging.sql`, criada com a CLI e
alinhada à versão registrada pela aplicação no projeto `zzphucuiqhzrilrddxnf`.
As políticas das tabelas antigas não mudaram. A API pública usa wrappers invoker;
o código privilegiado fica em `sc_private`, com nomes qualificados, search_path
vazio e autorização por `auth.uid()` em cada chamada. Nenhum papel/usuário pode
ser escolhido pelo cliente. O registro interno tem RLS e não concede CRUD a
`anon` ou `authenticated`.

A operação retorna somente confirmação, status e revisão, sem dados financeiros,
contatos, assinaturas ou notas internas. Não altera Google Agenda. Não ativa
contas de técnicos/parceiros e não muda produção.

## Evidências

- 54 scripts `*.test.cjs` aprovados localmente.
- PostgreSQL isolado: perfil RS/SC, parceiro, financeiro, inativo, sem vínculo,
  revogação de unidade/conta, transição por revisão, repetição exata, colisão de
  tentativa, dados privados preservados e ausência de acesso direto à tabela.
  O mesmo ensaio passou com IDs UUID e textuais.
- Chromium, viewport 412 × 915: módulos reais da aplicação com HTTP e identidades
  sintéticos; confirmação explícita, perda de resposta, repetição do mesmo UUID
  sem novo avanço e botão ausente quando a permissão é recusada. Regressão de
  navegação/pendências também passou. Não é autenticação HTTP real.
- Supabase de testes: execução SQL sob papel authenticated e identidade do
  gestor, registro sintético, avanço e repetição confirmados, seguida de
  ROLLBACK. Não substitui uma sessão Auth real de técnico/parceiro.

Após migração e ensaio, agenda (5 registros), vistorias (2) e acessos (1)
mantiveram contagens e hashes anteriores. O novo registro de tentativas permaneceu
vazio após o ROLLBACK. Anônimo não pode executar a mutação pública.

Advisors: nenhum novo aviso de nível WARN. O INFO adicional corresponde ao
registro interno com RLS sem políticas, propositalmente sem CRUD direto.
Permanecem os cinco avisos anteriores de funções definer públicas e o de
proteção contra senhas vazadas desativada; revisar no pacote oficial conforme
[documentação do linter](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
e [proteção de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Limites antes do oficial

Ainda faltam sessões Auth reais dos técnicos RS/SC e parceiro, ensaio em aparelho
físico, escrita completa de vistoria/fotos por perfil e implantação coordenada
com o schema oficial. A migração é exclusiva de testes e não deve ser aplicada
automaticamente em produção. Uma reversão de interface não deve apagar o registro
de tentativas nem os dados produzidos.
