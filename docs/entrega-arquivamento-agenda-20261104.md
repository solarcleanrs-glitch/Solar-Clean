# Confirmar arquivamento após perda de resposta — testes

Base: f2a4e86d6d24e6644613c46fe3cdd2331efa14d8, candidata do PR #4.

## Problema e resultado

O servidor podia arquivar um agendamento e a resposta se perder antes de o
aparelho receber a confirmação. Repetir a ação com a revisão anterior retornava
zero linhas, deixando a operação sem confirmação mesmo com o evento arquivado.

O aplicativo mantém a escrita condicional por ID, revisão e ausência de
arquivamento. Se a resposta se perder, vier incompleta ou não confirmar uma
linha, consulta somente ID, revisão, data do arquivamento e data da atualização.
Só reconhece o estado final quando o mesmo ID está arquivado com revisão válida.
A recuperação não faz uma segunda escrita nem adota a revisão remota para
sobrescrever um evento ainda ativo. Evento já arquivado localmente é reconferido
por leitura, inclusive numa tentativa repetida da mesma ação.

Se houver edição local pendente ou revisão local divergente antes da chamada,
a ação é recusada antes do envio. Se a edição ocorrer durante a chamada, a cópia
local é preservada para revisão. Falta de permissão, ausência do registro,
resposta inválida, perda de conexão sem confirmação ou mudança de conta não
apagam nem ocultam a cópia local como se o arquivamento tivesse terminado.

## Escopo

- Somente projeto de testes; nenhuma mudança no banco ou nas permissões.
- A ação continua arquivando no aplicativo. O evento Google permanece ativo.
- Nenhuma exclusão física ou reabertura automática.
- A confirmação pode reconhecer arquivamento feito por outra sessão autorizada;
  confirma o estado atual, não atribui a autoria à tentativa deste aparelho.
- Não há fila nova de arquivamento offline. Se não for possível conferir a
  nuvem, atualizar a agenda ou repetir a ação com conexão.

## Verificação

- `node tests/agenda-archive-retry.test.cjs`: resposta perdida, corpo inválido,
  zero linhas, recusa HTTP, divergência, datas/revisões inválidas, edição local,
  troca de sessão e tentativas repetidas/concorrentes.
- `NODE_PATH=./tests/postgres/node_modules node tests/agenda-archive-db.integration.cjs`:
  PostgreSQL isolado com migração existente, dados sintéticos e RLS; arquiva uma
  vez, confirma por leitura, recusa outra conta e DELETE e preserva campos
  comerciais e vínculo Google.
- Suíte local dos 52 scripts `*.test.cjs` aprovada. A validação autenticada com
  perfis reais de técnico/parceiro continua pendente e não é substituída por
  esses ensaios.
