# Meta de lançamento — dezembro de 2026

Diretriz do responsável em 04/11: ausência de aproximadamente duas semanas, preparar o lançamento no retorno (em torno de 18/11), operar e testar em dezembro para iniciar 2027 com estabilidade. Esta é uma meta, não uma publicação automática autorizada. Produção depende de revisão final; execução interativa não permanece ativa por duas semanas após o encerramento da sessão.

## Ordem de entrega

| Prioridade | Entrega | Critério de liberação |
| --- | --- | --- |
| 1 | Acessos e dados por usuário | Régis global; Fabiano RS sem SC; David somente agenda/vistoria, com unidade confirmada; cache/filas sem mistura entre contas e recuperação do legado conferida. |
| 2 | Operação de campo | Criar e editar vistoria, fotos, assinatura e relatório, avançar status e sincronizar após reconexão, sem duplicar nem perder pendências. |
| 3 | Agenda, CRM e cobrança | Arquivar com confirmação; importar clientes com revisão; registrar contato/cadastro; fechar serviços por parceiro e registrar recebimentos com totais conferidos. |
| 4 | Piloto oficial | Backup/restauração conferidos; pacote adaptado aos IDs e arquivos reais; aprovação explícita; validação com sessões dos perfis e aparelho físico; reversão preparada. |
| 5 | Ampliações | Push, geocodificação, portal completo de parceiros, despesas e WhatsApp automático em entregas próprias, com dependências externas resolvidas. Não declarar estas funções prontas por existirem telas ou planos. |

## Marcos verificáveis

- PR #2 reúne o pacote de homologação, ainda sem merge em main.
- PR #7 contém a candidata de permissões, com migração não aplicada; os ensaios usam contas fictícias.
- Candidata 44 inicia isolamento obrigatório, com regressão em navegador. Ainda exige recuperação do legado e capacidades de interface antes da integração principal.
- Candidatas 45/46 ligam capacidades do servidor à interface e separam cache, rascunhos e diários pela revisão de acesso. A candidata admite gestão RS em sua própria área; a candidata 47 acrescenta criação/edição técnica, fotos, assinatura, PDF e recuperação de conflitos. Permanecem pendentes conciliação do legado, operação totalmente offline e validação hospedada com contas reais. Nenhuma destas revisões está no oficial.
- Nenhuma conta pessoal secundária deve ser convertida silenciosamente em funcionário. Não cadastrar identidades por nome nem copiar UUIDs do oficial para o teste.
