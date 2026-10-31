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


## Base de armazenamento isolado — preparada, NÃO ativada

`lib/scoped-vistoria-store.js` implementa namespaces por projeto exato de testes + UUID da conta; a identidade deve ser fornecida por contexto validado da aplicação, nunca por nome/e-mail. Sessão captura namespace imutável e compara o contexto antes/depois das operações. Cópia exige conta responsável explícita, mantém IDs locais, fotos, snapshots e fila; compara destino, rejeita conflitos sem substituir, aguarda commit e relê os registros para conferir o conteúdo. O adaptador IndexedDB copia o lote em uma transação. Não possui operação de apagar o legado, rede ou localStorage.

Testes com backend simulado passaram: A→B→A, mesma chave local em duas contas, cópia verificada e idempotente, foto/fila preservadas, conflito prévio sem cópia parcial, destino corrompido e resposta atrasada. Isto não é validação real do adaptador IndexedDB no navegador.

Não há `<script>` no aplicativo nem ativação de namespace: os dados antigos continuam no armazenamento atual. Antes de ativar, falta interface de conferência/exportação/cópia do legado, contexto capturado em todos os caminhos assíncronos e teste real com fotos e duas contas. Não alegar isolamento completo instalado.

## Revisão 21 — conferência/cópia sem ativação

Painel em Dados da empresa, exclusivo do hostname de staging. Valida sessão em `/auth/v1/user`, confronta UUID com a sessão atual, captura geração/tokens/projeto e consulta o banco legado por dbAll. Exibe conta, vistorias, fotos e pendentes. Exige declaração explícita da conta responsável; copia somente após confirmar que o legado não mudou, relê destino e origem. Nenhum botão ativa namespace operacional. Conta/arquivo alterado invalida a conferência. Dados originais não são apagados. Objetos não JSON (por exemplo Blob), IDs inválidos e conflitos bloqueiam a cópia para revisão própria, sem descarte.

`tests/scoped-vistoria-browser.html` é um ensaio independente: cria namespaces novos com UUIDs aleatórios e dados sintéticos; não acessa banco legado, Supabase ou dados reais. Confere IndexedDB, cópia, releitura, foto/pendência, repetição, A/B/A e transação com conflito. O painel real ainda exige homologação com a conta e dados do gestor; não confundir esse ensaio com migração operacional concluída.


Ensaio executado no Chrome remoto em 31/10/2026 após publicação da revisão 21: PASSOU em IndexedDB real, com registros sintéticos e namespaces novos. Cópia/releitura, preservação de texto de foto/pendência, repetição sem duplicar, A/B/A e rejeição de conflito sem cópia parcial confirmados na interface do ensaio. Foto sintética é texto data URL de teste, não imagem real de vistoria. Não houve acesso ao banco operacional nesse ensaio. Ainda falta a conferência com o legado real do gestor.


## Evidência real da cópia e revisão 22

Régis enviou a confirmação da revisão 21: 2 vistorias copiadas, 2 novas, 0 já presentes, para a conta gestora. Inspeção prévia mostrou 1 foto e 0 vistorias pendentes. A mensagem confirmou releitura da cópia, originais mantidos e armazenamento novo não ativado. Cópia básica do legado real validada; não pedir repetição sem mudança que a justifique.

Revisão 22: guardas capturam geração de identificação, projeto/chave, técnico local e UUID do JWT antes da primeira espera. Renovação do token da mesma conta é tolerada; saída/troca de conta/projeto interrompe pushRecord, pullCloud, upload/download de fotos, hidratação e coordenação syncAll nos pontos protegidos. Uploads em andamento passam a distinguir geração/projeto/ID local. Testes controlados trocaram conta durante leitura do corpo remoto e consulta local: não houve escrita de vistoria nem confirmação como sincronizada na nova conta.

Limite: não desfaz requisição já enviada; um envio pode ter sido confirmado no servidor e continuar pendente no aparelho, exigindo a reconciliação pelo mesmo UUID já implementada. Não há namespace operacional ativo. Ainda revisar helpers internos de vínculo, agenda/CRM, todos os escritores assíncronos, formulários/renderizações/backup e transações antes da ativação. Isto reduz corridas em caminhos centrais, não comprova isolamento completo.
