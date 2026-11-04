# Sequência de liberação — preparação, sem autorização de produção

Atualizado em 03/11/2026. Este documento não aplica migrações nem libera contas.

## Bloqueios de liberação

- Validar no navegador uma sessão real de gestor: consultar cliente importado, abrir histórico e registrar/repetir um contato de teste previamente identificado. Não usar cliente real para gerar contato comercial fictício persistente.
- Validar técnico RS, técnico SC e parceiro: leitura autorizada e recusa de outra unidade/parceiro, pagamentos, notas internas, arquivo interno e escrita proibida. Não ativar usuários reais automaticamente para executar esses testes.
- Concluir edição cadastral/status comercial com revisão de concorrência. O cadastro inicial e os eventos Google originais devem continuar imutáveis, e a repetição da importação deve continuar idempotente após qualquer edição.
- Adaptar a implantação ao schema legado: preservar IDs textuais da agenda, IDs existentes das vistorias, campos nulos, fotos e vínculos. Não copiar todas as migrações de testes diretamente para o oficial.

## Ordem de preparação

1. Fixar o commit candidato e registrar os testes/artefatos aprovados desse mesmo commit.
2. Conferir inventário e backup recentes. Não repetir restaurações já aprovadas sem nova mudança que justifique isso. Backups locais do disco E: dependem do aparelho do responsável.
3. Ensaiar o pacote adaptado em cópia isolada do schema legado. Comparar contagens, chaves e dados antes/depois. Exercitar falha e reversão.
4. Preparar a versão do app junto das permissões: trocar apenas RLS pode interromper um cliente antigo que ainda use acesso anônimo ou consultas diretas.
5. Revisar com o responsável o pacote exato, janela de implantação e retorno. Só depois autorizar alterações no oficial e merge na main.
6. Após publicação autorizada, conferir login, leitura, gravação, relatório/foto, CRM e financeiro com as contas previstas. Não considerar build aprovado como validação de operação autenticada.

## Retorno

Manter artefato anterior e restauração ensaiada. Não remover colunas/tabelas, desativar RLS ou apagar registros como rollback automático. Uma mudança de código e uma mudança de banco podem exigir retornos distintos; registrar dependências e preservar os dados produzidos durante a janela.

## Estado conhecido

O histórico de contatos importados foi implementado e ensaiado com ROLLBACK. O login real do gestor, a consulta dos cinco clientes, a abertura do formulário/histórico e a limpeza na troca de pesquisa foram conferidos no navegador. A gravação e repetição pela interface e os demais perfis reais ainda estão pendentes. As consultas de campo ainda são uma área de testes separada: não substituem integralmente os fluxos antigos. A tentativa de contato fica em memória; após recarregar a página, conferir o histórico antes de criar outro registro em caso de resposta incerta.
