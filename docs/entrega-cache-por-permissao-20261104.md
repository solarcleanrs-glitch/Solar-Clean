# Candidata 46 — cache e filas por permissão

Esta revisão sucede a candidata 45 no PR #7. Continua em rascunho, com duas migrações candidatas **não aplicadas**, sem ativação de pessoas e sem alteração no oficial ou na homologação principal.

## Problema resolvido na candidata

Separar dados apenas pelo UUID do usuário não impedia que a mesma conta, anteriormente global, reencontrasse dados de SC depois de passar a ter somente RS. Agora o servidor fornece uma revisão derivada de papel, unidades, parceiro e capacidades. O aplicativo abre uma área distinta para cada combinação de conta e revisão confirmada.

| Conteúdo | Separação |
| --- | --- |
| Vistorias e fotos locais | IndexedDB por conta + revisão de acesso |
| Agenda, clientes, CRM e contatos | Chaves por conta + revisão de acesso |
| Formulários incompletos e rascunhos recuperados | Cofre v2 por conta + revisão; v1 preservado |
| Intenções financeiras | Mesmo UUID/conteúdo no diário da revisão original; sem reenvio por outra revisão |
| Importações de clientes | Fila e Web Lock por conta + revisão + identidade do evento |
| Backup de trabalho | Somente a revisão atual, incluindo suas filas; comparação recusa backup de outra revisão |

Não há cópia automática entre áreas, exclusão das antigas ou reclassificação por nome/cidade. A função antiga de migração é recusada neste modo, pois não concilia permissões. Uma volta a uma permissão anteriormente concedida pode reencontrar sua área original, ainda sujeita a confirmação atual do servidor.

Sem permissão confirmada/expirada, os dados não retornam ao namespace anterior. Mudança de revisão invalida operações antigas e preserva o formulário no cofre original antes de trocar a área de trabalho. Falha de preservação mantém o formulário em quarentena. Consulta de capacidades tem limite de 15 segundos; não mantém autorização antiga após recusa.

## Gestor RS e conferência do legado

Histórico, painel e CRM passam a admitir o gestor por unidade, usando exclusivamente o cache da revisão confirmada. As consultas remotas permanecem limitadas pelas políticas e RPCs da candidata. Técnico/parceiro continuam fora dos caminhos brutos financeiros; isso não libera escrita técnica de vistoria.

O gestor global pode listar e baixar, somente leitura, as áreas antigas deste navegador. A lista inclui cache do aparelho, cache por conta e cache por revisão, inclusive áreas identificadas apenas por filas/rascunhos. A cópia preserva texto bruto, fotos serializáveis, intenções financeiras/importação e rascunhos da origem selecionada. Exclui tokens, reconfirma conta/acesso/fonte antes do download e não importa, envia ou declara propriedade dos dados. Inventário só é lido depois da autorização global.

Integração Google direta continua global até existir vínculo por unidade. A conexão local é descartada em mudança de conta/permissão; callback atrasado não restaura token. O salvamento da agenda confere a sessão após respostas externas antes de alterar o cache atual. Isso não estabelece idempotência para uma criação Google cuja resposta se perdeu.

## Evidências

- `permission-scope.test.cjs`: mesma identidade com áreas distintas, rascunhos, diários e importações; invalidação de operação antiga; preservação de bytes; inventário global antes das leituras; cópia sem tokens; backup de outra revisão recusado.
- `permission-scope.browser.cjs`: aplicativo completo em Chromium, 412×915, domínio de testes e preview, dados/Auth sintéticos. Cenário RS/SC → RS → acesso recusado → RS → global, com vistoria/foto, agenda, CRM, formulário aberto, callback Google atrasado e áreas originais preservadas. As telas RS ficam habilitadas sem herdar SC.
- Regressões de isolamento A/B/A, capacidades, navegação, avanço de status, diários, backup e integrações PostgreSQL continuam obrigatórias no CI. Fixtures são geradas do HTML e só permitem dados/UUIDs sintéticos.

## Pendências antes de aplicar e ativar perfis reais

1. Recuperação seletiva e conciliação de pendências entre áreas após conferência do gestor. Não promover cópias completas nem reenviar intenções antigas com outro UUID.
2. Concluir criação/edição de vistoria e fotos para técnico; definir e validar o fluxo offline por perfil. Esta candidata exige confirmação de acesso para abrir a área de trabalho e suspende o uso ao ficar offline, preservando rascunhos.
3. Ensaiar sessões reais, duas abas reais, aparelho físico e o esquema hospedado com IDs legados. O evento externo de logout dos testes anteriores é simulado; o isolamento local não substitui RLS nem garante invalidação instantânea de todo dado já baixado após uma reclassificação individual de registro.
4. Revisar advisors e executar o pacote coordenado de homologação antes de qualquer proposta oficial. Usuários Fabiano/David continuam sem ativação e a unidade RS do técnico permanece hipótese restritiva do ensaio.
