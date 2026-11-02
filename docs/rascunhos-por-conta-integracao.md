# Rascunhos por conta — integração candidata, revisão 29

O aplicativo carrega o cofre, o controlador e o adaptador de formulário. A integração permanece **inativa** enquanto o armazenamento por conta não estiver ativado. Esta revisão não cria nem altera o marcador de ativação. Não habilitar o armazenamento por conta apenas para testar esta tela com dados reais.

## Implementado

- Cofre separado por proprietário e UUID de formulário, sem exclusão automática de cópias.
- Preservação e conferência antes da substituição dos tokens no login ou da remoção no logout. Falha de espaço bloqueia a troca e mantém o formulário.
- Adaptador dos controles reais: conserva campos incompletos, zeros, opções desmarcadas, fotos, assinatura, etapa, edição/revisão e ID textual da agenda. Não coleta arquivos dos inputs nem senhas.
- Consulta e recuperação explícita de cópias da própria conta. A recuperação cria outra cópia de trabalho; não executa gravação de vistoria, cobrança ou sincronização.
- Limpeza de formulário, fotos, assinatura técnica e cliente, relatório e listas após a cópia conferida e a troca efetiva.
- Uma assinatura técnica da conta anterior não é cadastrada na nova conta por herança durante o login candidato.
- Identificador estável do rascunho para a futura gravação da vistoria; uma cópia que já originou registro local não pode criar outro registro na mesma execução sequencial. Uma cópia antiga sem esse identificador exige conferência pelo histórico.
- Decodificação atrasada de assinatura do cliente não pinta o formulário de outra sessão.

## Evidências automatizadas

`form-draft-app.test.cjs` executa as funções reais de integração, login e logout extraídas do aplicativo. Confere falta de espaço sem mudança de tokens, limpeza após troca, recuperação A/B/A, revisão da edição, agenda textual, zero, não herança da assinatura técnica e rejeição de duplicação sequencial. O modo desativado conserva o comportamento anterior.

`form-draft-adapter.test.cjs` confere compatibilidade do formulário antes da primeira alteração dos controles. `account-draft-vault.test.cjs` e `account-draft-session.test.cjs` conferem isolamento, falhas, conteúdo incompatível com JSON e recuperação sem sobrescrever a origem. Os módulos possuem entrada CommonJS para os testes e arquivos JavaScript próprios para o navegador.

## Pendências antes da ativação

1. Coordenação efetiva entre abas: o evento de troca de conta externa precisa preservar o formulário da conta de origem antes de limpar a tela. IDs distintos por formulário evitam colisões comuns, mas não substituem uma estratégia de exclusão mútua.
2. Testar duas abas recuperando e salvando a mesma origem, mudanças de projeto/modo e expiração de sessão com formulário aberto. A busca por UUID antes do salvamento sequencial não é uma garantia atômica entre abas.
3. Validar recuperação em navegador com o armazenamento por conta ativado apenas em cenário sintético isolado, incluindo fotos maiores, assinatura e exportação de relatório. Os testes VM não substituem essa validação.
4. Conferir integralidade das cópias de dados por conta antes de habilitar a nova persistência. Os dados legados continuam preservados.

O marcador de ativação continua ausente por padrão. O aplicativo oficial e o banco oficial não são alterados por esta implementação.
