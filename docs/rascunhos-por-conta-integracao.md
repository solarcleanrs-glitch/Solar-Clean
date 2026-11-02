# Rascunhos por conta — preparação

O cofre e o controlador de transição estão testados como módulos, mas não estão carregados pelo aplicativo. Não há salvamento automático, recuperação na tela nem mudança de armazenamento ativados por esta etapa.

Contrato para a integração:

1. Capturar o proprietário ao abrir o formulário. Guardar o rascunho e conferir a gravação antes de substituir tokens no login ou removê-los no logout. Falha de espaço deve manter o formulário e interromper a troca.
2. Usar um UUID de rascunho por formulário/aba. Nunca usar um único ID fixo por conta. Preservar também identidade e revisão da edição, vínculo com agenda, etapa, fotos e assinaturas.
3. Recuperar somente após conferir novamente a conta autenticada. Exigir ação explícita e reconstruir as guardas da sessão atual. A recuperação não pode criar vistoria, agenda, cobrança ou sincronização.
4. Limpar formulário, prévias, relatório e assinatura da conta anterior somente após a confirmação da cópia. Retirar a assinatura técnica anterior dos campos de login.
5. Coordenar abas antes de habilitar o fluxo. `expectedRaw` apenas rejeita uma versão já desatualizada antes da escrita; localStorage não oferece compare-and-swap atômico. Não usar essa checagem como substituta de exclusão mútua entre abas.
6. Testar troca A/B/A, logout, expiração, duas abas, falta de espaço e edição com vínculo real em homologação antes da ativação. Produção permanece fora do escopo do módulo.

O módulo rejeita conteúdos que JSON perderia silenciosamente, incluindo valores indefinidos, números não finitos, datas, mídia binária e ciclos. Fotos e assinaturas já representadas como strings são preservadas. Não possui exclusão automática de cópias.

O controlador `account-draft-session.cjs` já exige cópia conferida antes da função que altera a sessão, mantém o formulário se a cópia ou o login falhar e recupera em uma nova cópia sem sobrescrever a origem. Ainda faltam os adaptadores reais de formulário e de autenticação, além da coordenação entre abas.
