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

1. Validar a integração completa entre abas no aplicativo, incluindo sessão expirada e operações em andamento. A revisão 30 implementa preservação externa e exclusão mútua; o ensaio sintético dos módulos passou, mas não habilita dados reais.
2. Testar mudanças de projeto/modo e expiração de sessão com formulário aberto. O fluxo candidato envolve a busca e a gravação no Web Lock por origem; a API precisa estar disponível no navegador de campo.
3. Validar recuperação em navegador com o armazenamento por conta ativado apenas em cenário sintético isolado, incluindo fotos maiores, assinatura e exportação de relatório. Os testes VM não substituem essa validação.
4. Conferir integralidade das cópias de dados por conta antes de habilitar a nova persistência. Os dados legados continuam preservados.

O marcador de ativação continua ausente por padrão. O aplicativo oficial e o banco oficial não são alterados por esta implementação.

## Revisão 30 — coordenação candidata entre abas

A integração agora trata eventos externos de tokens/identificação. Um formulário aberto é copiado usando o proprietário capturado na abertura, sem reclassificá-lo pelo token da nova conta. Se a cópia falhar, a navegação fica bloqueada e o formulário permanece em memória; o usuário pode tentar preservar novamente. O aviso de saída do navegador é solicitado enquanto essa situação existir.

O salvamento candidato usa Web Locks exclusivos por proprietário e UUID do rascunho, envolvendo a checagem de duplicidade e o fluxo de gravação. Uma aba que aguardava o bloqueio confere novamente sessão e formulário antes de salvar. Navegadores sem essa API não salvam por um caminho desprotegido.

`draft-multitab.test.cjs` confere filas concorrentes, rejeição de cópia já gravada, sessão alterada enquanto aguarda e falha de espaço seguida de nova tentativa. `form-draft-app.test.cjs` também cobre o bloqueio e a recuperação na integração real extraída do app.

O cenário `tests/draft-multitab-browser.html` permite conferir Web Locks, IndexedDB e eventos de armazenamento com duas abas reais. Ele usa apenas dados fictícios e chaves prefixadas por um UUID de simulação. Não habilita o modo por conta do aplicativo e não lê nem modifica tokens reais. Esses ensaios de módulos não substituem a validação completa da migração, da expiração de sessão e das operações em andamento no aplicativo antes de uma ativação com dados reais.

Ensaio observado em Chrome, com duas abas reais: primeira aba reteve o Web Lock durante uma pausa; a segunda aguardou e depois recebeu a rejeição de cópia já gravada. IndexedDB permaneceu com um registro. A troca A → B limpou o formulário da outra aba e mostrou zero cópias em B; ao voltar para A, a cópia foi recuperada com o cliente fictício original. Nenhum token ou registro real foi usado.
