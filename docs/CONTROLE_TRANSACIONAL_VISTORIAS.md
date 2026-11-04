# Controle transacional de vistorias — especificação para homologação

**Status: planejamento, não executado.** Exclusivamente Supabase de testes `zzphucuiqhzrilrddxnf`, branch `feature/crm-whatsapp-recorrencia-20261028`. Não alterar produção.

## Problema
A checagem preventiva de `updated_at` no navegador tem uma janela de corrida: duas sessões podem ler a mesma revisão e gravar em sequência. Relógios dos dispositivos também podem divergir.

## Protocolo alvo
1. Introduzir uma versão inteira `revision` gerenciada no banco; clientes não podem escolher ou diminuir a versão.
2. Uma leitura retorna `revision`; o navegador guarda `baseRevision` enquanto edita.
3. Alteração usa uma **única operação transacional** condicionada a `client_uuid` e à revisão esperada; incrementa `revision` somente se corresponder.
4. Se não houve atualização, retornar conflito; manter a cópia local e suas fotos.
5. Criação usa caminho separado e idempotente; colisão de UUID nunca vira sobrescrita.
6. Autorização respeita RLS efetiva e deve ser validada com duas contas de teste. A função não pode elevar privilégios indevidamente.
7. A ativação depende de revisar o esquema real da tabela, gatilhos e políticas antes de escrever SQL. Não supor que o campo `updated_at` seja gerenciado pelo servidor.
8. Preparar migração reversível e testes antes de habilitar no aplicativo; recursos incompatíveis continuam desativados.

## Aceitação
- Duas sessões leem revisão 1; A salva e obtém revisão 2; B com revisão 1 recebe conflito.
- Duas gravações realmente simultâneas com revisão 1: exatamente uma é aceita.
- Conta sem autorização não consulta nem altera dados.
- Repetição após falha de rede não duplica, nem declara sucesso sem confirmar o resultado.
- Não apaga fotos, assinaturas ou observações em caso de conflito.
- Cliente offline mantém todos os dados pendentes e recebe informação de conflito ao reconectar.

## Ponto de decisão
Antes da migração, executar apenas consultas de leitura no **projeto de testes** para conferir colunas, PK/índices, gatilhos e RLS da tabela `public.vistorias`. Depois preparar e revisar SQL específico para a estrutura real. Não executar SQL sem revisão e autorização específica.
