# Plano de execução acelerada — até terça-feira 03/11/2026

**Ambiente:** somente feature branch de homologação, Cloudflare Pages de testes e Supabase Solar Clean testes crm. **Proibido alterar produção.**

## P0 — finalizar segurança antes de avançar
1. Resolver a vistoria fictícia pendente: UUID remoto encontrado, sessão autorizada, revisão remota 1, revisão local 0; backup local exportado. Não preencher baseRevision=1 cegamente sem conferir a origem do registro e o risco de sobrescrever alterações. Preservar ambos os estados.
2. Testar revisão transacional A/B e validação de RLS com duas sessões autenticadas.
3. Não liberar produção enquanto houver conflito pendente e sem backup recuperável.

## P1 — origem do serviço
- Origem obrigatória no agendamento: Particular Solar Clean, YES, Elysia, Outro parceiro (cadastrável).
- Persistir `partner_id` (nulo para particular) com referência a `parceiros`, não texto livre como chave.
- Propagar agendamento → vistoria → CRM/relatórios preservando origem e unidade RS/SC.
- Se iniciada fora da agenda, técnico seleciona origem na vistoria. Alterações de origem requerem autorização e histórico.
- Migração no banco de testes com RLS; campos novos opcionais para registros antigos, sem perder histórico.
- Antes de publicar, testar separação por perfil e permissões de informações financeiras.

## P2 — precificação por parceiro
- Tabela individual por parceiro, por faixa da quantidade de placas, com vigência e histórico de versões.
- Base do serviço = faixa de placas vigente na data de execução; permitir ajuste justificado.
- Itens adicionais: distância, troca de componente, serviço extra; manter descrição, quantidade, valor cobrado e custo real SEPARADOS.
- Aprovação de extras: pendente / aprovado / não cobrado.
- Congelar preço e versão de tabela no serviço executado. Alterações futuras de tabelas não mudam fechamentos antigos.
- YES e Elysia: não presumir valores; cadastrar tabela real depois. Nunca preencher preço fictício em dados operacionais.

## P3 — faturamento mensal de parceiros
- YES/Elysia recebem lista de serviços executados no mês, pagam total em pagamento consolidado.
- Entidade `fechamentos` com parceiro, competência, vencimento opcional, status (rascunho, enviado, parcialmente pago, pago), total e comprovante.
- `fechamento_itens` aponta para serviços; cada serviço aparece em no máximo um fechamento vigente por parceiro.
- `recebimentos`: data, valor, meio de pagamento, referência do fechamento, suporte a pagamento parcial, conciliação.
- Distinção entre faturamento por competência e caixa por data efetiva de recebimento.
- Relatórios PDF/CSV por parceiro e competência: data, cliente, cidade, placas, serviço base, extras aprovados, total. Evitar expor observações internas.

## P4 — relatórios e custos
- Filtros CRM: Particular / YES / Elysia / Outro parceiro, RS/SC, mês, município, situação do pagamento.
- Dashboard: serviços, placas, faturado, recebido, a receber, custos atribuídos, margem (não confundir com lucro líquido contábil).
- Custos: combustível, pedágio, peças, alimentação, mão de obra, outros; classificação por serviço, parceiro, unidade, período. Custos indiretos discriminados para evitar margem fictícia.
- Valores confidenciais visíveis apenas aos perfis autorizados. RLS e não apenas ocultação de interface.

## Critérios de entrega
- Implementar migrações isoladas e compatíveis com tabelas existentes; aplicar somente após revisão de schema e autorização.
- Acrescentar testes automáticos de preço por faixa, duplicação de fechamento, total de extras, pagamento parcial e filtros.
- Testes E2E fictícios: YES 2 serviços + Elysia 1 + Particular 1, consolidar mês; conferir valores sem tabelas reais; repetir sync sem duplicar.
- Sem publicar em produção sem decisão explícita.
