# Candidata 47 — vistoria técnica

Entrega preparada para o perfil técnico solicitado para David, sem ativar contas reais. Nenhuma migração desta candidata foi aplicada em ambiente hospedado e nenhuma alteração foi publicada no oficial.

## Comportamento

- Iniciar uma vistoria a partir de agenda autorizada e reabrir a mesma vistoria para edição. Uma reserva por agendamento impede duplicação técnica.
- Preencher dados técnicos, enviar fotos, colher assinaturas e gerar PDF pelo formulário existente. Valores, pagamentos, observações e arquivos internos ficam fora da API e da edição técnica.
- Persistir intenção e fotos localmente antes do envio. UUID e conteúdo imutáveis permitem repetir respostas perdidas; upload não substitui objetos existentes e compara bytes ao recuperar uma resposta perdida.
- Conferir revisão do servidor antes de editar. Em conflito, o usuário pode conferir a versão da nuvem, abandonar a tentativa pendente e preservar sua cópia em arquivo local/exportação. Não há sobrescrita silenciosa.
- Validar autorização atual em cada RPC e leitura de foto. Cancelamento e confirmação são serializados. Erros de restrições do banco não retornam detalhes de linhas comerciais.
- Preservar valores e metadados internos no servidor, inclusive fotos desconhecidas. Não excluir arquivos do Storage.

## Referências

- `lib/field-inspection-api.js`: DTO seguro, intenção, upload e repetição.
- `lib/field-inspection-ui.js`: formulário, fila, reabertura, conflito e exportação.
- `index.html`, `lib/field-agenda-ui.js`: integração com agenda, assinaturas e relatório.
- `supabase/migrations/20261105002422_field_inspection_write_staging.sql`: APIs restritas, reservas, controle de revisão e Storage.
- `tests/field-inspection-api.test.cjs`, `tests/field-inspection-db.integration.cjs`, `tests/field-inspection.browser.cjs`: cobertura com dados fictícios, inclusive UUID e texto em agenda legada.

## Preparação hospedada pendente

Aplicar somente após revisão de esquema e pré-requisitos, em testes: migrações `20261104222525`, `20261104231318` e `20261105002422`, nesta ordem. A revisão de vistoria deve existir previamente. Conferir advisors, políticas e funções efetivamente instaladas antes de habilitar contas. Confirmar a unidade de David e as identidades reais de David/Fabiano; não há contas de funcionários ativadas por esta entrega.

Validar em dispositivo físico, duas abas, conectividade instável e contas reais de teste. A autorização ainda exige confirmação online: o fluxo preserva rascunhos/tentativas e retoma após reconexão, mas não constitui operação totalmente offline. Permanecem conciliação seletiva do legado e revisão final do pacote antes de qualquer lançamento oficial.
