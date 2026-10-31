# Isolamento local — levantamento de bloqueios

Produção intocada. Este documento não representa correção instalada.

## Evidências no código atual

- IndexedDB solarCleanDB/vistorias é único no aparelho, sem projeto/actor no nome.
- Agenda, clientes, metadados e histórico CRM usam chaves globais localStorage.
- crmMetaCache e listas renderizadas sobrevivem em memória até nova renderização.
- Logout remove access token, mas deixa refresh token. Identificação técnica local
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
