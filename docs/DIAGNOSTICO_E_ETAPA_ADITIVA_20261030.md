# Diagnóstico confirmado e primeira etapa proposta — 30/10/2026

Projeto autorizado para leitura: Solar Clean testes crm / zzphucuiqhzrilrddxnf.
Fonte: resultados de consultas de metadados enviados pelo usuário nesta sessão.
Etapa 1 executada manualmente pelo usuário após autorização. Usuário reportou sucesso
e retornou quatro tabelas novas com RLS=true e privilégios de leitura/escrita=false
para anon e authenticated. O nome histórico do arquivo SQL foi preservado.
Não houve execução de escrita pelo agente. A segunda etapa foi posteriormente
executada pelo usuário, com resultados registrados abaixo.

## Evidência recebida

- RLS ativo em crm_perfis, crm_usuarios, vistorias, crm_contatos e crm_metadados.
- As políticas apresentadas de CRM, vistorias e bucket vistoria-media verificam
  apenas presença em crm_usuarios. Não contêm escopo RS/SC ou parceiro.
- crm_usuarios contém somente user_id, PK e FK para auth.users.
- CRM usa client_key como chave de perfil/metadados e como referência sem FK em contatos.
- Vistorias têm PK id e UNIQUE client_uuid. Não há FK ligando a vistoria ao CRM.
- revision bigint NOT NULL existe. Gatilho vistorias_revision_update está habilitado,
  incrementa old.revision e avança updated_at no servidor. Isso confirma o mecanismo
  do servidor; não demonstra teste de concorrência real nem que todos os aparelhos
  estejam usando PATCH condicionado à revisão.
- A listagem recebida não trouxe tabelas clientes, agenda, agendamentos ou parceiros.
  Não presumir que a agenda remota esteja disponível neste projeto.

## Decisão de implementação

O código atual usa telefone ou nome+cidade como client_key. A mesma pessoa pode
ter serviços em mais de uma unidade ou com parceiros diferentes. Não adicionar
um parceiro único ao perfil legado nem inferir a unidade pela cidade.

Criar identidade de escopo UUID (cliente + unidade + parceiro), à qual a vistoria
será vinculada. Um vínculo único evita campos unidade/parceiro contraditórios.
Vínculos existentes permanecem nulos até revisão; nenhuma vistoria é excluída.
Os novos registros de acesso partem desativados e não recebem usuários automaticamente.

## SQL concreto para primeira autorização

Arquivo: ../supabase/migrations/20261030_access_foundation_STAGING_NOT_APPLIED.sql

1. Criar sc_parceiros, sem nomes/preços ou linhas presumidas.
2. Criar sc_acessos (gestor/técnico/financeiro/parceiro) e sc_acesso_unidades (RS/SC).
3. Criar sc_clientes_escopos para classificação explícita, sem copiar dados pessoais.
4. Adicionar somente sc_escopo_id opcional às vistorias, com FK e índice.
5. Habilitar RLS nas quatro tabelas novas e revogar privilégios da API comum.
6. Não substituir políticas atuais, criar funções privilegiadas ou conceder acesso.

Execução transacional, exige projeto conferido e autorização específica. A execução
repetida falha; não utiliza IF NOT EXISTS para esconder uma instalação divergente.
ALTER TABLE requer lock breve, a avaliar conforme uso do ambiente de testes.

## Limite desta etapa

Esta etapa prepara a estrutura e NÃO resolve o acesso amplo das políticas atuais.
As novas tabelas não são consumidas pelo aplicativo. Usuários atuais continuam sob
as regras antigas; não cadastrar parceiros nelas antes da etapa de autorização.
Não há publicação, migração de produção, alteração de preços ou exclusão de registros.

## Próxima etapa após autorização e preparação

- Confirmar UUIDs das contas fictícias e atribuições antes de ativar acessos.
- Definir projeções de dados para técnico, financeiro e parceiro. RLS filtra linhas,
  não oculta colunas financeiras e observações internas de uma linha autorizada.
- Criar CRM com chave de escopo e migrar cópias classificadas de forma revisável;
  jamais reaproveitar nota comercial global em resposta destinada a parceiro.
- Adaptar agenda, payloads, consultas e cache local à conta e ao escopo. Revogar
  acesso remoto não elimina dados que um aparelho já baixou.
- Substituir explicitamente as políticas amplas dentro de transação revisada;
  adicionar políticas restritivas ao lado das permissivas não corrige o isolamento.
- Autorizar fotos por escopo da vistoria; caminhos atuais iniciam com client_uuid.
  O app envia fotos antes da vistoria, portanto a reserva de acesso ao UUID precisa
  preceder o upload. Não liberar upload simplesmente por prefixo escolhido pelo cliente.
- Testar via JWTs distintos: gestor, técnico RS, técnico SC, parceiros A/B, desconhecido;
  cobrir troca de escopo, notas/financeiro e URLs de fotos, além de concorrência.

## Verificação realizada nesta sessão

- Testes locais existentes e cálculo de fechamento passaram antes desta proposta.
- O cálculo financeiro é módulo puro separado do app, usa dados fictícios e centavos,
  exclui extras pendentes e histórico importado, detecta recebimentos/serviços duplicados.
- SQL não foi validado por um PostgreSQL local. A aplicação da primeira etapa
  foi reportada pelo usuário conforme registrado acima.
- Não afirmar segurança real ou compatibilidade operacional aprovada antes do teste
  integrado no projeto de testes, após autorização.

## Segunda etapa aplicada pelo usuário

Arquivo: ../supabase/migrations/20261030_manager_gate_STAGING_NOT_APPLIED.sql.

Conta única em crm_usuarios confirmada pelo diagnóstico do usuário. O SQL verifica
UUID e e-mail exatos antes do cadastro; cria gestor ativo com unidades RS e SC.
Concede SELECT/INSERT/UPDATE nas quatro tabelas novas somente sob política de gestor.
O gestor poderá administrar os cadastros de acesso, inclusive outros gestores.

Uma função de leitura SECURITY DEFINER, com dono postgres e search_path vazio,
consulta apenas o papel do próprio usuário autenticado. Nenhum ID é recebido como
parâmetro. Execução revogada de PUBLIC/anon e concedida somente a authenticated.

Políticas AS RESTRICTIVE acrescentam uma condição obrigatória de gestor às
políticas atuais de crm_perfis, crm_contatos, crm_metadados, vistorias e somente
do bucket vistoria-media. Não usar novas políticas permissivas para esse bloqueio.
Nenhum grant das tabelas antigas é ampliado; nenhuma exclusão é habilitada.

Isso é contenção provisória para acesso remoto autenticado: técnicos e parceiros
continuam bloqueados até APIs/projeções e testes por escopo estarem concluídos.
Não elimina cópias locais, URLs assinadas ainda válidas, nem impede acesso de
administradores/roles que já ignoram RLS. Não prova segregação operacional RS/SC.
O usuário reportou Success e retornou consulta comprovando gestor ativo RS/SC,
quatro políticas novas permissivas e cinco políticas restritivas esperadas.
Confirmou funcionamento de CRM, vistoria e fotos no app de testes.
Confirmou o resultado esperado da simulação SQL com role authenticated e sub
sem cadastro: gestor=false e contagens de vistorias, perfis, contatos, metadados
e objetos de vistoria-media iguais a zero. Essa é confirmação relatada pelo usuário;
não foi uma segunda sessão com JWT real. Esse teste real segue pendente.

## Preservação de vínculo no aplicativo — implementação local

O aplicativo agora preserva sc_escopo_id como scopeId ao baixar, editar e reenviar
uma vistoria. Valores ausentes/nulos no legado não enviam um NULL capaz de apagar
vínculo remoto. UUID inválido interrompe envio; vínculo de testes impede envio para
outro projeto antes de enviar fotos ou consultar a vistoria remota.
Não cria nem classifica escopos automaticamente e não é controle de autorização;
o banco continua responsável por permitir/rejeitar qualquer vínculo enviado.

Testes executaram ida/volta pelo payload real, salvamento de edição, ausência
de vínculo legado, UUID inválido e tentativa de envio a outro projeto sem chamadas
de upload/consulta. Testes locais passaram; arquivos não foram publicados.
Migração do CRM por escopo ainda não implementada. A UI de vistoria foi preparada
na etapa seguinte, descrita abaixo.

## Seleção de origem na vistoria — código local, sem publicação

- Painel de identificação do serviço, visível somente com configuração do projeto
  de testes, com unidade RS/SC e origem Particular ou parceiro UUID cadastrado.
- Parceiros vêm de sc_parceiros; nomes YES/Elysia não viram chaves nem registros
  fictícios no banco. Sem parceiros cadastrados, apenas Particular está disponível.
- Novas vistorias exigem classificação explícita. Edição de legado não classificado
  pode continuar sem classificar. Não inferir unidade ou parceiro por nome/cidade.
- Escopo já vinculado é apresentado como leitura e preservado durante a edição.
- Reutilização de formulário de um serviço gera novo vínculo ao salvar; início
  pela agenda aproveita somente a unidade explícita do agendamento, sem herdar
  parceiro de atendimento anterior do mesmo cliente.
- Criação do escopo ocorre na sincronização, antes de upload das fotos, com UUID
  persistido no registro local. POST ignora conflito de ID, nunca faz UPDATE;
  leitura posterior precisa confirmar unidade/parceiro. Falha mantém pendência.
- Leitura remota de vínculo ausente sem contexto explícito não recria o registro.
- Formulário novo funciona offline para Particular; catálogo previamente carregado
  pode continuar na página. Recarregar offline não promete lista de parceiros.
- Testes com fixtures cobrem formulário, legado, repetição e interrupção de envio,
  divergência remota, catálogo ativo/inativo, resposta assíncrona obsoleta e offline.
  Não foi executado E2E no Supabase com essa nova versão nem QA visual em navegador.

### Pendência específica da agenda

O código consulta public.agenda_eventos, nome que não constava do primeiro
diagnóstico de schema. Não assumir ausência dessa tabela. Preparada consulta de
metadados inspecionar_agenda_eventos_somente_leitura.sql para verificar colunas,
políticas e RLS. Não enviar novas colunas à agenda antes dessa conferência.
Origem/parceiro na agenda e passagem desse vínculo para a vistoria ainda pendentes.
