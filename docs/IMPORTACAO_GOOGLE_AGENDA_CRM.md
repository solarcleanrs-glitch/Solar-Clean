# Importação histórica Google Agenda → CRM Solar Clean

**Prioridade alta antes do piloto operacional.** Projeto de testes exclusivamente. Não apagar nem editar eventos Google. Não importar dados reais no Supabase de testes sem confirmação explícita.

## Evidência de viabilidade (29/10/2026)
A conexão Google Calendar retornou calendários, incluindo `solarclean.rs@gmail.com` (acesso de escrita disponível, mas usar SOMENTE leitura para importação). Amostra read-only de 50 eventos de 2025: 50 tinham título, 49 localização, 50 descrição. A busca tem mais páginas. Não concluir contagem total com base na amostra.

## Fluxo proposto
1. Selecionar calendário `solarclean.rs@gmail.com`, intervalo histórico e unidade RS/SC.
2. Paginar TODOS os eventos por janelas de 6 a 12 meses; guardar `calendar_id`, `event_id` e `updated` para sincronização incremental.
3. Extrair candidatos: nome, telefone (normalizar DDI/DDD, preservar original), cidade/endereço, data do serviço, observações relevantes, origem YES/Elysia/Particular quando identificável e com nível de confiança. Não inventar valores ou dados ausentes.
4. Pré-visualização com contadores: eventos lidos, potenciais atendimentos, clientes únicos, possíveis duplicados, sem telefone, eventos não relacionados.
5. Deduplicar por telefone válido normalizado, depois combinação nome+cidade e revisão assistida. Uma pessoa pode ter vários serviços e mais de uma usina; não mesclar automaticamente só pelo primeiro nome.
6. Importar em duas entidades: cadastro de cliente e histórico de atendimentos anteriores. Eventos históricos não são vistorias técnicas concluídas com fotos/assinatura; etiquetar `historico_google_agenda`.
7. Vincular o histórico à recorrência; última data identificada e próxima recomendada (sugerida, não confirmada). Não iniciar contato/WhatsApp automático sem verificar consentimento e status **Não contatar**.
8. Reexecutar importação de forma idempotente: chave `calendar_id:event_id` e trilha de alterações. Nunca apagar eventos ou dados já importados por ausência temporária.
9. Segurança: dados reais pessoais; usar ambiente autorizado, RLS, perfis e backups. Proibir enviar contatos reais ao projeto fictício de homologação. Prévia deve limitar exposição de informações.
10. Relatórios de qualidade pós-importação e ação para corrigir itens ambíguos manualmente.

## Escopo de importação
- Inicial RS; considerar outra agenda SC se existente e indicada.
- Priorizar serviços dos últimos 2–3 anos; histórico anterior por lotes progressivos.
- Criar filtro CRM `Origem do cadastro: Google Agenda` e `Histórico importado`.
- Para serviços de parceiros, não deduzir YES/Elysia pelo nome do cliente sem evidência.

## Aceite
- Contagens de eventos e clientes conferidas; exemplo de 20 eventos revisado.
- Rodar importação duas vezes sem criar duplicatas.
- Preservar calendário intacto e registros marcados como Não contatar.
- Histórico importado não vira receita/recebimento automaticamente.
- Usuários não autorizados não acessam dados pessoais.
- Processo de rollback/retirada do lote criado com identificador de importação.
