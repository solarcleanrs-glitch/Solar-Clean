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
