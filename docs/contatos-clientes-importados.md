# Histórico de contatos dos clientes importados — testes

No painel “Agenda e relatórios por acesso — testes”, consulte clientes
importados. O gestor ativo recebe a ação “Histórico e contato — gestor”. Ela
mostra contatos anteriores e permite registrar resultado, observação interna
e retorno previsto. Registrar não envia mensagens, cria agenda/cobrança ou
altera status comercial. Os registros do CRM antigo continuam separados.

## Segurança e dados

Tabela privada `sc_private.cliente_contatos`, com RLS ativo e sem leitura ou
escrita direta para a API. Chamadas públicas são wrappers invoker; as funções
privadas validam gestor ativo por UUID e vínculo de membro antes de acessar
o histórico. Outros perfis não leem as notas nem registram contatos nesta etapa.
Não há função de edição ou exclusão: o histórico é imutável pela API.

O contato aponta para o ID explícito de `sc_clientes`. Não associa pessoas
por nome ou telefone e não modifica o cadastro inicial ou a origem Google.
O servidor registra autor e horário; o histórico devolvido não inclui o UUID
do autor. Observação de até 2.000 caracteres e resultado em lista aprovada.

## Repetição e falhas

Cada registro possui UUID permanente nesta tentativa. A primeira gravação
insere, e a repetição idêntica retorna confirmação sem criar outra linha.
Mesmo UUID com cliente, autor ou conteúdo diferente é recusado. Um lock
transacional serializa tentativas concorrentes com o mesmo identificador.

A interface congela os dados após iniciar o envio. Em resposta incerta, “Tentar
novamente o mesmo contato” reenvia exatamente o mesmo identificador e conteúdo.
Há bloqueio de clique simultâneo e conferência da sessão antes/depois das
requisições. Ao confirmar, a interface atualiza o histórico e bloqueia novo
envio daquele formulário. Troca de conta/filtros remove o formulário da tela.

A tentativa permanece apenas em memória: fechar ou recarregar a página pode
perder o identificador de reenvio. Após resposta incerta, consulte o histórico
antes de criar outro registro. Não há fila offline ou recuperação automática
de tentativa após reiniciar. Nenhum envio é repetido em segundo plano.

## Conferências

`imported-contact-db.integration.cjs`: PostgreSQL isolado, gravação do gestor,
repetição idêntica, divergência de conteúdo/cliente/autor, nota excessiva,
cliente ausente, permissões diretas negadas, técnico/conta desconhecida/anônimo,
revogação, notas privadas e preservação dos clientes.

`imported-contact-api.test.cjs` e `field-report-ui.test.cjs`: intenção imutável,
resposta perdida e repetição com mesmo corpo, identidade da confirmação,
mudança de sessão, formulário congelado e confirmação sem novo registro.

No banco de testes, um ensaio transacional gravou e repetiu um contato técnico,
confirmou somente uma linha e negou outra conta. Tudo foi desfeito por ROLLBACK;
a tabela ficou vazia. Clientes e origens Google permaneceram iguais. Não houve
contato comercial real criado, mensagem enviada ou alteração em produção.

Falta validar o formulário com sessão real do gestor no navegador e os demais
perfis reais antes da liberação geral. Este módulo não inclui edição cadastral,
status comercial por perfil nem a implantação oficial.
