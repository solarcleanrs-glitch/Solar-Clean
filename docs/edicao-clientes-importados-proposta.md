# Edição de clientes importados — testes

Disponível ao gestor no painel “Agenda e relatórios por acesso — testes”,
após consultar clientes, em “Editar cadastro e status — gestor”.
A migração `20261104014308_imported_client_edit_staging.sql` foi aplicada
somente ao projeto Solar Clean testes crm. A proposta anterior foi substituída.

## Campos e autorização

Somente gestor ativo e membro cadastrado pode ler o editor, consultar o
histórico ou alterar nome, telefone, cidade, endereço e status comercial.
Técnico, parceiro, financeiro, anônimo e conta desconhecida são recusados.
Unidade, origem, parceiro, cadastro inicial e referências Google permanecem
preservados; não há associação por nome ou telefone.

O status começa em “Em conferência”. Os demais valores são Ativo,
Recorrência pendente, Recuperação, Inativo e Não contatar. Este status pertence
aos clientes importados; ainda não substitui status do CRM antigo ou regras
de recorrência. Nenhuma mensagem é enviada e nenhuma agenda/cobrança é criada.

O servidor recusa novos registros de contato neste módulo quando o cliente
está marcado “Não contatar”. Usa bloqueio compartilhado da mesma linha que
a edição atualiza, para não ignorar uma alteração concorrente do status.
A repetição exata de um contato já confirmado continua confirmável, sem
criar outro registro, mesmo após o bloqueio. Não configura integração ou
bloqueio automático em serviços externos.

## Concorrência, repetição e histórico

`sc_cliente_edicao` entrega campos atuais e revisão. `sc_editar_cliente`
exige cliente explícito, revisão lida, cinco campos completos e UUID de
tentativa. Bloqueia a linha e recusa revisão antiga. Não sobrescreve
automaticamente outra edição.

Cada tentativa conserva o mesmo UUID e conteúdo. A interface congela os
campos depois de iniciar o envio e bloqueia clique simultâneo. Em resposta
incerta, “Repetir a mesma edição” usa o mesmo corpo. Ao confirmar, bloqueia
novo envio daquele formulário. A confirmação repetida informa a revisão
produzida pela operação; consultar novamente mostra o cadastro atual.
A tentativa fica em memória: após recarregar a página, conferir cadastro e
histórico antes de tentar uma nova edição. Não existe fila offline.

O histórico privado registra autor, horário e campos antes/depois.
`sc_historico_edicoes_cliente` devolve ao gestor as revisões e alterações,
sem UUID do autor ou cadastro inicial bruto. O histórico não pode ser
editado/excluído pela API. Troca de conta ou filtros limpa o editor e
respostas atrasadas são descartadas.

As funções privilegiadas ficam no schema privado com search_path vazio.
Wrappers públicos são security invoker. RLS e ausência de grants diretos
protegem a tabela privada. O aviso informativo “RLS sem política” é
intencional nessa tabela sem acesso direto:
https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## Verificação e limites

O teste PostgreSQL isolado cobre edição, repetição exata, conflito de revisão,
campos/tipos indevidos, papéis recusados, revogação, acesso direto proibido,
histórico e bloqueio de contato. Executa novamente a importação original
depois da edição e confere que ela não desfaz a correção nem duplica a origem.

Os testes de API/interface cobrem projeção, revisão, intenção congelada,
resposta perdida e reenvio, identidade da confirmação e troca de sessão.

No Supabase de testes, um ensaio transacional verificou edição, repetição,
conflito, histórico e bloqueio de contato. Foi desfeito por ROLLBACK.
Depois, edições e contatos permaneceram em zero; contagens e hashes dos campos
originais de clientes, origens Google, vistorias e fotos permaneceram iguais.
A coluna nova contém o status inicial; nenhum cliente foi marcado ativo
automaticamente. Não houve alteração em produção.

Ainda faltam validação do formulário com sessão real e validação dos demais
perfis reais, além de adaptação/ensaio do schema oficial e revisão conjunta.
