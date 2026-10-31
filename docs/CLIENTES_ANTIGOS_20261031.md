# Histórico Google — preparação de clientes antigos

## Exportação verificada

Leitura da agenda compartilhada Solar Clean com janela de 31/10/2024 inclusive
a 31/10/2026 exclusive, fuso America/Sao_Paulo. Paginação encerrada: 1.242 eventos,
1.242 IDs únicos. Não representa toda a vida da empresa nem exportação do Google
Contacts. A agenda pessoal e os feriados não foram incluídos. Nenhum evento Google
foi criado ou alterado. Os dados privados ficam fora do repositório e do deploy.

## Preparador somente leitura

`lib/google-history-review.cjs` preserva os eventos completos e identifica
telefones conservadoramente: rótulos explícitos, wa.me, DDD entre parênteses ou
DDD separado de número com hífen.
Não cria o nono dígito de telefones antigos. Ausência de telefone identificado não
significa ausência de telefone no texto; formatos antigos exigem conferência.
Nome, unidade e parceiro são sugestões baseadas em título/endereço, nunca
autorização ou classificação cadastral confirmada.

Só propõe agrupamento quando telefone único, título e endereço completos
normalizados são idênticos. Mesmo assim mantém reviewRequired. Sem esses três
campos, preserva um candidato por evento. Telefones compartilhados entre
candidatos são destacados; não funde por nome parecido, telefone sozinho ou cidade.
Eventos cancelados são excluídos da lista de candidatos, permanecendo no arquivo
original. IDs repetidos com conteúdo diferente interrompem o processamento.

Resultado inicial: 1.242 candidatos, 1.167 sem telefone reconhecido, 6 candidatos
com telefone presente em outro candidato e 3 possíveis eventos sem cliente.
Não houve fusão automática nem importação no CRM. Evento confirmado não comprova
serviço concluído, pagamento, consentimento de contato ou elegibilidade financeira.

## Uso local

```
node scripts/preparar-historico-google.cjs entrada.json revisao.json
node scripts/gerar-conferencia-historico.cjs entrada.json conferencia.html
```

Ambos criam saída exclusiva: não substituem originais ou revisões anteriores.
A página permite busca e filtros locais, mostra 25 candidatos por página e usa
textContent para todo conteúdo dos eventos. Não há envio de dados nem importação.
O JSON original e a conferência contêm informações pessoais: não adicionar ao git,
aos artefatos públicos de CI ou ao pacote hospedado do aplicativo.

## Próximos passos

1. Conferir campos e conflitos, inclusive telefones em formatos não reconhecidos.
2. Definir os registros aprovados, sem criar agendamentos retroativos ou débitos.
3. Completar persistência de clientes no projeto de testes: o código antigo consulta
   `public.clientes`, ausente na estrutura exportada recebida nesta sessão.
4. Integrar importação idempotente por agenda+evento, com trilha de origem, revisão
   e isolamento por conta. Somente então validar o fluxo no CRM de testes.

## Base SQL preparada — ainda não instalada

`20261031_clientes_historico_STAGING_NOT_APPLIED.sql` cria sc_clientes e
sc_cliente_origens_google. Não reutiliza silenciosamente o contrato legado
public.clientes: é necessário adaptar explicitamente o leitor e o editor do CRM.
Somente gestor lê; escrita direta é revogada. RPC exige revisão explícita, campos
sem valores financeiros, unidade RS/SC e origem definida (inclusive não informada).
Parceiro cadastrado e ativo é obrigatório quando a origem for parceiro.

Origem composta agenda+evento é única. Repetição com mesmo ID de cliente, cadastro
e evento devolve a confirmação anterior; conteúdo diferente falha sem sobrescrever.
Lock transacional serializa identidade de origem e depois de cliente. Dois eventos
podem apontar ao mesmo cliente somente com ID/cadastro explicitamente iguais.
Telefone compartilhado não une pessoas automaticamente. O evento original fica
preservado com ator e data da confirmação. Nenhuma agenda ou cobrança é criada.

PGlite executou a migração e verificou RLS, bloqueio de não gestor, escrita direta
negada, dados inválidos sem gravação parcial, replay, conflito de conteúdo e duas
pessoas com mesmo telefone. Esses testes são sequenciais em banco embarcado; não
substituem teste concorrente em conexões Supabase nem JWT real.

`lib/client-history-import-plan.cjs` prepara o contrato RPC de eventos aprovados,
valida agenda de origem, confirmação/campos explícitos, preserva IDs para replay e
não faz I/O. Falta interface que grave aprovações e fila durável por conta, adaptação
do cadastro legado e instalação da migração no projeto de testes. Não está liberado
no aplicativo nem há importação real executada.

## Revisão 14 — tela conectada, instalação do banco pendente

Painel Clientes antigos no CRM de staging lê o JSON original exportado e permite
buscar, selecionar e revisar um evento. Nome/telefone/endereço são sugestões;
unidade e origem exigem escolha explícita. Parceiros vêm do servidor. A conta
precisa passar no sc_is_manager real e na leitura da nova tabela; estrutura
ausente bloqueia o envio com mensagem, sem fallback à tabela legada.

O adaptador grava a intenção exata em chave por projeto+actor+agenda+evento antes
do POST. Exige Web Locks entre abas, conserva UUID em replay e falhas ambíguas,
interrompe troca de contexto e valida o resultado retornado. Escrita local negada
impede envio. Journal confirmado evita novo POST; conflitos exigem revisão, sem
limpar automaticamente operações anteriores. A tela não permite edição durante o
envio e limpa o conteúdo ao mudar sessão/conta em outra aba. Isto não corrige os
caches globais legados de vistorias/agenda/CRM, que permanecem bloqueio de produção.

Backup staging inclui textos exatos dessas intenções somente da conta atual.
Ensaio isolado os preserva e valida prefixo/conta, sem comparação nem ativação.
Não inclui tokens. A base importada ainda é separada da lista CRM legada; não
atribui uma data de serviço à data de criação de cliente nem produz recorrência
automática. Unir à lista geral exige adaptar identidade/perfis sem fusão por
telefone e validar a migração de cache.

Testes locais cobrem montagem da tela com DOM simulado, schema ausente, revisão
explícita, limpeza de sessão, storage negado, replay com ID anterior, erro de rede,
resposta incompatível e troca de conta. Não são testes de importação real no
Supabase: a migração ainda não foi instalada, e nenhum cliente real foi importado.

## Validação real pelo gestor e revisão 15

Em 31/10 o gestor confirmou Success na execução do SQL, acesso verificado na tela
e cadastro confirmado com ID a026a52e-d3b6-496e-bb4c-a3794e1dfcc3. Esta é evidência
relatada pelo usuário, sem consulta direta do banco pelo agente. O arquivo de
migração conserva NOT_APPLIED no nome histórico; a instalação foi relatada e não
deve ser repetida sem conferir o estado atual. Não sabemos qual evento/cliente foi
selecionado, e não presumimos que mais registros tenham sido importados.

Revisão 15 integra leitura paginada de sc_clientes à lista geral de CRM somente no
projeto/domínio de testes e com sessão conectada. Não grava em caches legados.
Chave sc_cliente:UUID impede fusão por nome ou telefone. Cadastros entram como
Em conferência, zero atendimentos, sem última vistoria ou recorrência inferidas.
Nesta etapa são de consulta: sem editor CRM ou WhatsApp automático. Histórico de
serviços e perfis comerciais só deve ser vinculado por ação específica posterior.

Renderizações atrasadas verificam geração e actor antes de preencher a lista;
troca de identificação ou sessão em outra aba limpa a lista/editor e invalida
respostas em curso. Isso protege essa exibição, mas não resolve o armazenamento
global legado de vistorias/agenda/CRM, que permanece pendente.

Teste exercita o agregador real com uma vistoria legada e dois clientes importados
com mesmo telefone: conserva três identidades, nenhuma vistoria falsa e nenhuma
recorrência para importados. Paginação, erro HTTP, identidade inválida e troca de
conta também são testados. Confirmação visual do cliente real na nova lista ainda
depende de conferência do gestor no aparelho autenticado.

## Revisão 16 — vínculo explícito ao mesmo cliente

O gestor confirmou que o primeiro cliente aparece corretamente na revisão 15.
A tela agora exige escolher Cadastrar novo cliente ou Vincular a cliente já
importado. O segundo modo carrega os cadastros permitidos pelo servidor, com busca
por nome, telefone e cidade. Não pré-seleciona ninguém. Escolher um existente
preenche os campos com o cadastro confirmado e os bloqueia; envio reutiliza seu
UUID e seus campos, sem sobrescrever o cadastro a partir do novo evento.

Não exige outra migração: a RPC instalada já admite vários eventos para o mesmo
UUID/cadastro. Seleção de pessoa diferente para uma operação local pendente ou
confirmada é rejeitada, mesmo quando os nomes/telefones são iguais. Intenções de
criação antigas sem targetMode conservam replay do UUID original. Confirmar um
vínculo também não significa confirmar que o serviço foi executado.

Cartões importados oferecem Histórico Google vinculado, consulta paginada das
origens daquele UUID com detalhes escapados. Troca de conta ou clique em outro
cliente invalida respostas anteriores. Não grava cache global e não transforma
datas de eventos em última vistoria, recorrência, agenda ou financeiro.

Testes de interface simulada cobrem destino não selecionado, campos bloqueados,
reutilização do UUID e preservação do nome existente mesmo se um campo for
alterado programaticamente. SQL embarcado confirma um cliente com dois eventos,
replay do segundo e campos inalterados. Fluxo com dados reais ainda requer uma
conferência pelo gestor: selecionar outro evento da MESMA pessoa, associá-lo ao
cliente existente e consultar o histórico vinculado. Não repetir a migração.

## Revisão 17 — lote revisado (31/10)

Histórico ampliado, a pedido de Régis, para 05/12/2022–30/10/2026: 741 eventos adicionais, 1.983 IDs únicos no arquivo combinado. O usuário confirmou visualmente eventos de 2023 no aplicativo. Nenhum cliente adicional foi importado pelo agente.

Nova seção abaixo da revisão individual, com pesquisa e páginas de 15 cadastros sugeridos. Cada cartão permite conferir os eventos originais, editar campos, selecionar explicitamente um cadastro existente ou criar um novo e marcar a revisão. Sugestões de agrupamento continuam limitadas à coincidência de telefone único, título completo e endereço completo; não há fusão automática por nome/telefone. Casos repetidos por nome/telefone com clientes já importados, ou repetidos dentro do lote, exigem vínculo existente ou revisão individual.

Botão único envia os marcados sequencialmente pelo mesmo RPC e diário por conta. Valida todo o plano antes da primeira escrita. Em falha, interrompe, mantém decisões/UUIDs congelados e retoma o item pendente; confirmados não são reenviados durante a mesma sessão. Ao reabrir, o diário durável continua protegendo cada evento, mas as seleções do lote são temporárias e não são restauradas. Não é transação única: uma parte pode estar confirmada antes de uma falha. Nenhuma nova migração SQL; não cria agenda, cobrança ou mensagem.

Validação: testes de interface e lote com dados sintéticos (falha intermediária, retomada de payload exato, não reenvio dos confirmados, validação antes da escrita, limpeza e repetidos), suíte rápida completa e verificações dos arquivos gerados. Importação real em lote ainda depende de homologação pelo gestor.


## Homologação real e revisão 18

Régis forneceu fotos de sucesso de lotes com 1 e 3 cadastros no staging; na primeira o CRM exibia 4 clientes totais (não inferir todos como importados). Uso básico em lote validado pelo usuário. Não é necessário importar todo o histórico para concluir esse teste. Associação de vários eventos à mesma pessoa continua sem validação real demonstrada; testes sintéticos passaram.

Acompanhamento: contagem dos marcados atualiza imediatamente e aparece também no botão, inclusive seleção em outras páginas; mensagem identifica o último lote; cartões já confirmados ficam bloqueados para edição nessa sessão. Não há persistência das seleções entre recargas. Produção não alterada.


## Confirmação real de vários eventos (31/10)

Foto do histórico vinculado do Gaston mostra 2 eventos, 19/09/2024 e 29/10/2026, sob um único cadastro. O usuário confirmou que realizou a associação. Fluxo básico de vários eventos validado no staging; não pedir repetição. Isto não confirma serviços realizados ou pagamentos.
