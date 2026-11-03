# Clientes importados por acesso — testes

O painel “Agenda e relatórios por acesso — testes”, na tela inicial, agora
oferece a consulta “Clientes importados por acesso”. Usa a unidade selecionada
e pesquisa por nome, telefone ou cidade. Não importa novos cadastros, não une
pessoas e não cria serviço, agenda, contato ou cobrança.

A RPC `sc_clientes_campo(p_unidade,p_busca)` devolve somente ID, nome, telefone,
cidade, endereço, unidade e origem. Unidade/origem/parceiro são os campos
explícitos de `sc_clientes`, conferidos no cadastro importado. Não existe
associação por telefone, nome ou uma chave legada inferida de outro cadastro.

Exige conta autenticada, membro cadastrado e papel operacional ativo. Gestor
consulta todos; técnico consulta unidades autorizadas com origem informada;
parceiro consulta seus próprios clientes, em unidades autorizadas e com
parceiro ativo. Origem não informada fica restrita ao gestor. Financeiro não
recebe acesso de campo por esta etapa. As regras vêm das tabelas no servidor,
não de nomes/e-mails ou metadados editáveis do usuário.

Não retorna cadastro inicial bruto, evento original do Google, notas internas,
identificação de quem importou, valores ou informações financeiras. As tabelas
antigas do CRM continuam protegidas. O histórico original segue disponível no
fluxo do gestor e permanece preservado; não foi aberto para os outros perfis.

## Interface e verificação

Consulta somente online, sem gravação local nem alternativa pelo cache antigo.
Pesquisa ou unidade alteradas limpam os resultados. Troca de conta limpa dados
e termo pesquisado. Respostas atrasadas são descartadas pelo contexto da sessão.

`scoped-clients-db.integration.cjs`: PostgreSQL isolado, unidades RS/SC, parceiros
diferentes, nomes/telefones iguais, conta desconhecida, financeiro, anônimo,
origem desconhecida, parceiro desativado, revogação e preservação dos originais.

`field-clients-api.test.cjs` e `field-report-ui.test.cjs`: paginação, projeção de
campos, unidade divergente, recusa sem fallback, pesquisa alterada durante a
consulta e limpeza na troca de conta.

Não substitui validação HTTP com contas reais de técnico/parceiro. A consulta
cobre os clientes importados da base separada `sc_clientes`; não é migração ou
classificação automática dos clientes derivados de vistorias antigas. Edição,
histórico comercial, registro de contatos e escrita operacional por perfil
continuam pendentes. Nenhum usuário foi ativado, e produção não foi alterada.
