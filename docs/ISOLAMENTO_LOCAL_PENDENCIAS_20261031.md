# Isolamento local — levantamento de bloqueios

Produção intocada. O levantamento continua pendente, exceto pelas correções de sessão registradas abaixo.

## Evidências no código atual

- IndexedDB solarCleanDB/vistorias é único no aparelho, sem projeto/actor no nome.
- Agenda, clientes, metadados e histórico CRM usam chaves globais localStorage.
- crmMetaCache e listas renderizadas sobrevivem em memória até nova renderização.
- Situação encontrada antes da revisão 19: logout removia access token, mas deixava refresh token. Identificação técnica local
  não é prova de autorização, e trocar nome/e-mail não deve transferir cache.
- Requisições iniciadas numa conta podem terminar após troca. Limpar só a tela ou
  o cache ao sair não impede que a resposta antiga seja escrita no espaço novo.
- Dados legados incluem filas pendentes e fotos; apagar ou atribuir a primeira
  conta logada automaticamente pode perder dados ou expor material de outra conta.

## Sequência necessária para implementação

1. Capturar contexto imutável projeto+UID após sessão validada; não usar nome/e-mail
   como identidade. Rotular armazenamento e operações assíncronas com esse contexto.
2. Usar namespace por contexto em IndexedDB e nas quatro chaves de agenda/CRM.
   Operação pendente retém o namespace capturado; resultado não pode renderizar ou
   preencher formulário de outra conta. Verificar geração do contexto após awaits.
3. Manter o legado intacto em quarentena e exportável. Migração exige declaração
   explícita da conta responsável e cópia verificada; nunca mover/apagar originais.
4. Logout invalida geração, remove ambos os tokens e material sensível em memória,
   esvazia telas/rascunhos/assinaturas da sessão. Não apaga dados offline pendentes.
5. Tratar duas abas, mudança de projeto, falha de espaço, aba com código antigo,
   refresh em curso e exportação/recuperação enquanto a conta muda.
6. Testar A→B→A com vistorias/fotos/fila local e resposta A atrasada, inclusive
   navegador offline. Não publicar em produção antes de verificar esses casos.

Importação de clientes antigos deve usar a nova persistência do servidor e uma
fila local por conta, sem alimentar o cache legado global. A implantação precisa
ser coordenada com a revisão de recuperação de backup ampliado e sua comparação.


## Revisão 19 — proteção parcial de sessão

Logout agora invalida a geração de autenticação, remove access e refresh tokens e limpa a senha do formulário. Login e renovação capturam geração, projeto, chave pública e valores da sessão antes da requisição; conferem após resposta e após leitura do corpo, antes de gravar tokens. Respostas antigas não podem reativar sessão encerrada ou sobrescrever conta/projeto alterado. Renovação simultânea da mesma sessão compartilha a operação; nova sessão não reutiliza a promessa antiga.

Teste de corridas com respostas controladas: saída durante login/refresh, alteração de conta/token/projeto, renovação compartilhada e login normal. Nenhum cache de vistoria, foto ou fila offline foi apagado/migrado. Isto NÃO implementa isolamento completo de armazenamento e NÃO elimina os demais bloqueios deste documento.


## Revisão 20 — confirmação da gravação local

Durante a preparação da migração, foi identificado que dbAdd/dbPut/dbDelete confirmavam no sucesso da requisição IndexedDB, antes da conclusão da transação. A transação ainda poderia abortar, por exemplo por falta de espaço. Agora os quatro acessores aguardam tx.oncomplete, rejeitam aborts inclusive após request.onsuccess e fecham a conexão ao finalizar. A consulta tolera datas legadas ausentes. Nenhum banco ou registro foi renomeado, apagado ou migrado.

Teste controlado simula sucesso da requisição seguido por abort, erro de requisição, erro de abertura, conclusão normal e ordenação legada. Validação sintética não substitui testes reais de falha de disco no navegador. Isolamento por conta permanece pendente; não ativar namespace novo antes da cópia preservada e verificada do legado.
