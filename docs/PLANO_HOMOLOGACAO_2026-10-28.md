# Solar Clean — plano de homologação e próximas entregas

**Ambiente isolado:** Cloudflare Pages `solar-clean-testes-crm.pages.dev`, branch `feature/crm-whatsapp-recorrencia-20261028`, Supabase `zzphucuiqhzrilrddxnf`.
**Regra:** não modificar `main`, a hospedagem original, ou qualquer banco de produção sem decisão específica do gestor.

## Já validado por uso real (28/10/2026)
- Login e sincronização da vistoria fictícia.
- Foto enviada para bucket privado `vistoria-media` e recuperada pelo app hospedado.
- CRM: cliente fictício com status **Não contatar** visível em outra sessão, botão de WhatsApp bloqueado.
- Observação comercial interna do cliente fictício salva na nuvem e lida em janela anônima.
- Testes CI de CRM e prevenção de duplicação passaram nos commits anteriores.

## Critérios de aceite ANTES de liberar uso real
1. Autorização: confirmar que usuário não cadastrado em `crm_usuarios` não lê nem grava `vistorias`, `crm_contatos`, `crm_perfis`, `crm_metadados` ou objetos privados. **Executar apenas com contas fictícias, não compartilhar tokens.**
2. Teste de liberação: alterar cliente fictício de **Não contatar** para **Ativo** e confirmar em sessão separada que o botão de WhatsApp volta a aparecer; bloquear novamente se necessário.
3. Teste de histórico: adicionar contato fictício, abrir sessão anônima, confirmar resultado, nota e data; repetir sincronização sem duplicar.
4. Conflitos offline: editar mesmo cliente em duas sessões, conferir resultado e informar limitações antes de uso real. Não apagar dados automaticamente em divergência.
5. Segurança de hospedagem: verificação de configurações no domínio de testes e bloqueio de conexão acidental ao Supabase de produção; revisar localStorage / troca de sessão.
6. Relatórios: imagens e assinaturas no PDF, valores financeiros restritos aos perfis autorizados, impressão e compatibilidade com dispositivos.
7. Restauração: exportar backup real de testes, importar em ambiente isolado e comparar contagens/fotos; nenhuma restauração na produção.

## Backlog ordenado por impacto
**P0 — Estabilidade e integridade**
- Revisar segurança da configuração de nuvem no Pages (o domínio de testes nunca deve apontar para produção).
- Garantir que falhas de upload não marquem registros como sincronizados.
- Melhorar tratamento de conflito de edição e autenticação/sessão expirada.
- Verificar eventuais lacunas de RLS para o módulo financeiro.

**P1 — Operação em campo**
- Corrigir navegação Voltar no Android.
- Compactação de imagens antes do envio e verificação de tamanho.
- Offline confiável com indicador claro de fila e reenvio idempotente.
- Abrir localização no Maps a partir do link do agendamento.
- Remover agendamento com confirmação e trilha de auditoria.

**P2 — Crescimento comercial**
- Consolidar CRM: segmentação por recorrência, razão de perda e histórico.
- WhatsApp: manter disparo manual, respeitar **Não contatar**. Automatizar apenas com consentimento e API oficial.
- Criar avisos de recorrência e tarefas de follow-up.
- Separar RS/SC por perfil e parceiro.

**P3 — Escala**
- Módulo de parceiros com isolamento por cliente.
- Notificações push (permissão explícita do usuário).
- Melhorias de financeiro, conciliação de pagamento e anexos.

## Critérios de rollback de homologação
- Não fazer merge na main automaticamente.
- Se surgir falha grave: suspender deploys da homologação; inspecionar logs e reverter commit da branch de testes; preservar dados do Supabase de testes.
- Não excluir buckets, políticas ou linhas de banco para resolver erro de interface sem backup.
- Não usar dados de clientes reais em testes de permissão.

## Próxima ação humana indispensável
- Validar com duas sessões (e contas fictícias diferentes) permissões RLS e liberação de contato. Não requer alterar SQL, apenas login de teste.
- Depois decidir se quer piloto restrito ou continuar melhoria offline.
