# Candidata 45 — capacidades do servidor na interface

A migração `20261104231318_operational_access_capabilities_staging.sql` é **candidata, não aplicada**. Depende da candidata de gestor por unidade. Não ativa pessoas, não altera a homologação principal nem o oficial.

## Implementado

- RPC `sc_acesso_operacional`: perfil e unidades da própria identidade autenticada, usando cadastro ativo e vínculo CRM. Função privilegiada privada, wrapper público invoker e grants somente authenticated. Sem autorização por nome, email ou metadata editável pelo usuário.
- Capacidades explícitas de agenda, gestão, relatórios, gravação, CRM, financeiro e administração. Técnico não tem escrita de vistoria nesta revisão; recebe consulta de agenda/relatório e o avanço de status protegido já existente.
- A consulta independente de clientes importados deixa de aceitar técnico também no servidor. Dados do cliente necessários ao serviço continuam nas projeções de agenda e relatório.
- Interface valida formato, identidade, unidades e coerência do perfil. Permissão fica apenas em memória, expira em um minuto e é reconsultada nas entradas principais. Falha de consulta não usa permissões antigas. Logout, troca de conta e evento offline limpam o acesso; formulário é preservado antes da suspensão, ou a tela fica em quarentena se a cópia falhar.
- Módulos e opções de unidade são bloqueados conforme o servidor. As funções antigas de visibilidade SC/financeiro consultam essas capacidades no teste, preservando o comportamento anterior dos outros projetos.
- Upload de gestor limitado exige capacidade de escrita e confirmação da reserva UUID/escopo antes da primeira foto. Recusa/resposta perdida da reserva interrompe o upload e preserva pendência.

## Restrição deliberada que ainda impede a liberação de Fabiano

Histórico, painel e CRM legados locais permanecem exclusivos do gestor global, mesmo se o backend autorizar gestão RS. Esses caches podem ter sido gravados quando a mesma identidade possuía acesso maior; separar somente pelo UUID não resolve a revogação de unidade. A etapa seguinte precisa versionar/reconciliar o cache por escopo de acesso e fornecer as telas RS sem herdar SC. Não ativar o perfil real antes disso.

O gate da interface é uma barreira de navegação; a autorização dos dados permanece nas políticas/RPCs. A revisão não transforma todos os caminhos antigos em APIs seguras nem conclui a operação offline por perfil.

## Evidências

- `operational-access.test.cjs`: formato e identidade, RS/SC, recusa de privilégios incompatíveis, expiração, falha de renovação, consulta concorrente única, resposta atrasada e projeto errado.
- `unit-manager-db.integration.cjs`: migrações reais compostas, capacidades do gestor global/limitado/técnico, bloqueio do catálogo técnico e revogação, além das regras anteriores de financeiro/mídia.
- `manager-media-reservation.test.cjs`: função real de upload exige autorização e reserva antes da foto; recusa, rede incerta ou ausência de escopo não enviam mídia.
- `operational-access.browser.cjs`: app completo Chromium 412×915, dois domínios de teste, Auth/HTTP fictícios. Nome/email contendo Régis não liberam SC; técnico tem apenas entradas autorizadas, sem catálogo/financeiro; revogação bloqueia novamente a entrada.

Não equivale a validação com as contas reais, aparelho físico ou mudanças no projeto oficial. O preview depende das migrações candidatas; se a RPC não estiver instalada, a interface fica bloqueada em vez de inventar permissões.
