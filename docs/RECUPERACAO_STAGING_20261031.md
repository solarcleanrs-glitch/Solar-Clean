# Recuperação — conferência de 31/10/2026

Não executar restauração sobre produção nem sobre o aparelho de trabalho.

## Cobertura atual observada no código

| Conteúdo | Persistência | Exportar backup atual |
|---|---|---|
| Vistorias e snapshots de conflito | IndexedDB solarCleanDB/vistorias | Sim, conteúdo de dbAll |
| Fotos incorporadas à vistoria | IndexedDB | Sim; referências remotas não são cópia dos arquivos |
| Configurações da empresa/projeto | solarCleanCompany | Sim |
| Agenda e fila pendente | solarCleanAgenda | Não |
| CRM local | solarCleanClients, solarCleanCrmMeta, solarCleanCrmContactHistory | Não |
| Intenção financeira pendente | journal por conta/projeto | Não |
| Fechamentos e recebimentos confirmados | PostgreSQL Supabase | Não |
| Arquivos no bucket vistoria-media | Storage Supabase | Não |

O código atual não oferece importação/restauração do JSON. Validação estrutural
não deve ser apresentada como teste de restauração. Não limpar armazenamento,
reinstalar app ou trocar conta no aparelho de trabalho enquanto houver filas.

## Preparação e critérios de aceitação

1. Guardar JSON local fora do navegador, preservando o original. Verificar com
   `node scripts/verificar-backup-local.cjs caminho-do-backup.json`.
   O verificador só lê e mostra contagens, sem clientes, chaves ou tokens.
2. Confirmar existência e data de backup do banco por mecanismo disponível ao
   projeto. Inventariar arquivos do Storage separadamente; backup do PostgreSQL
   não deve ser assumido como cópia dos bytes das mídias.
3. Preparar ambiente descartável isolado e restauração de teste; nunca usar o
   banco de produção como destino. Não apontar o app staging atual para outro
   projeto: ele possui bloqueio explícito de URL.
4. Comparar contagens e vínculos de agenda, escopos, parceiros, vistorias,
   fechamento/itens/recebimentos. Conferir saldo em centavos, ausência de dois
   vínculos ativos para o mesmo serviço e manutenção dos cancelados no histórico.
5. Conferir acesso aos bytes de fotos/assinaturas e abrir relatórios de amostra.
   Repetir login de gestor e conta sem vínculo no ambiente restaurado.
6. Validar recuperação de fila local sem repetir cobranças ou sobrescrever
   revisões. Preservar IDs de intenções financeiras; não recriar como nova ação.

## Estado

Roteiro e verificador preparados; restauração real não executada. Falta ampliar
cobertura do backup local e definir importação segura com validação de projeto,
conta, prévia e preservação das cópias existentes. Também faltam isolamento local
entre contas, papéis de campo por unidade e concorrência real entre dispositivos.
Aprovação de produção permanece pendente desses critérios.


## Revisão 11 — backup local ampliado, somente staging

Exportar backup preserva os campos app/company/vistorias antigos e acrescenta
stagingLocal v1 apenas no domínio de testes com projeto correto. Guarda textos
originais de agenda/CRM inclusive ilegíveis, e journal financeiro somente da conta
atual com ID estável. Não exporta tokens de acesso/renovação nem journals de outras
contas. Dados legados de agenda/CRM/vistorias ainda são do aparelho, não segregados
por conta: o backup declara essa limitação. Nenhuma autenticação do servidor é
inferida da identidade declarada no arquivo. Comparação antes/depois da leitura
assíncrona interrompe se dados locais/conta mudarem; não é snapshot transacional
entre IndexedDB e localStorage e não garante consistência com gravações remotas.
Não inclui bytes de mídia remota nem livro financeiro completo. Importação e
restauração continuam indisponíveis; validar recuperação antes de produção.
A tabela anterior descreve a cobertura antes desta revisão.

## Revisão 12 — ensaio de recuperação isolada

Histórico agora oferece seleção de JSON, prévia de contagens e aceite explícito
para cópia isolada. Aceita somente stagingLocal v1 do projeto de testes com actor
igual à conta conectada; backups antigos ou anônimos ficam preservados, mas não
são importados neste fluxo. Limite de arquivo: 100 MB. Valida formato, data, IDs
locais únicos, chaves permitidas, vínculo do journal à conta. Conteúdo local
ilegível permanece como texto com aviso, sem ativação.

O ensaio adiciona arquivo original no IndexedDB separado solarCleanRecoveryLab,
store archives, com ID novo; aguarda commit e abre uma leitura independente para
comparar texto integral e prévia. Não usa os stores de trabalho, não escreve em
localStorage, não executa conteúdo do JSON nem chama API. Conta/contexto mudados
interrompem confirmação; cópia já gravada continua isolada. Falta de espaço ou
corrupção na releitura não produzem mensagem de sucesso. Cópias anteriores não são
substituídas. O espaço isolado é local, sujeito a limpeza do navegador, e não
substitui guardar o JSON fora dele.

Testes automatizados usam backend sintético e cobrem preservação exata, foto,
journal, projeto/conta/versão incompatíveis, IDs repetidos, erro na releitura e
mudança de contexto. Não equivalem a restauração do PostgreSQL/Storage nem teste
real no aparelho do usuário. Promoção dos arquivos para os stores operacionais e
validação de restauração do banco/mídia continuam pendentes; não declarar sistema
recuperável em produção com base neste ensaio.


## Validação no aparelho e revisão 13

Usuário enviou confirmação visual do ensaio: 2 vistorias sincronizadas e, após
carregar agenda e exportar novo JSON, 5 agendamentos; 0 clientes CRM locais e
journal ausente. Releitura integral da cópia isolada concluída. Isso não demonstra
recuperação operacional nem backup completo do banco ou das mídias remotas.

Revisão 13 acrescenta comparação somente leitura do arquivo com os dados atuais:
iguais, ausentes, divergentes e exclusivos do aparelho para vistorias/agenda/CRM.
Vistorias usam cloudId como identidade quando disponível, mas mudança do ID local
continua divergência e requer revisão. Não deduz identidade por nome/telefone.
Conteúdo ilegível e identidades repetidas bloqueiam comparação da coleção; não
são tratados como listas vazias. Ordem de propriedades JSON não causa conflito.
Journal somente é comparado, sem reenvio ou promoção; diferença exige conferência.
A comparação não constitui comando de importação e não modifica stores de trabalho.


## Próxima conferência no banco

Preparada consulta conferir_integridade_fechamentos_STAGING.sql, somente SELECT,
sem nomes de clientes e sem alterações. Conta fechamentos/recebimentos e procura
divergência entre totais e itens, excesso de recebimento, vínculo incompatível com
status e mais de um fechamento ativo por serviço. Indicadores de erro devem ser
zero; contagens totais dependem dos testes mantidos pelo gestor. A consulta usa
um único statement para visão consistente desses indicadores. Não prova cobertura
de backup nem substitui teste de restauração do PostgreSQL/Storage.

Validada em PostgreSQL embarcado com fixtures sintéticas saudáveis e corrupção
transacional revertida: detectou total divergente e recebimento acima do saldo.
Resultado do banco Supabase real ainda não recebido. Não há conexão direta ao banco
nesta sessão; execução pelo gestor no projeto de testes é necessária.
