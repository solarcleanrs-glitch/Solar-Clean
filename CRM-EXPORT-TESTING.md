# Exportação de contatos no ambiente de testes

O app limita a exportação ao projeto Solar Clean testes CRM. A consulta retorna os contatos recuperados que estão nas unidades atribuídas a um gestor ativo. O número atual precisa coincidir com o registro de autorização. Revogação, bloqueio comercial e telefone duplicado impedem a exportação.

A última limpeza usa o serviço mais recente concluído e vinculado pelo identificador Google, na mesma unidade. Eventos arquivados, futuros, sem vínculo e com chave ambígua ficam de fora.

## Validação

- Supabase de testes: autorização, revogação, bloqueio de telefones duplicados e acesso de usuário sem perfil foram verificados em transações com dados fictícios e rollback.
- Agenda de testes: a data foi preenchida para evento concluído com vínculo confirmado, sem usar eventos em aberto, sem vínculo ou com chave ambígua.
- Interface simulada: pesquisa, registro e revogação. A alteração invalida a prévia.
- Download simulado: filtros de unidade e última limpeza, nova consulta ao baixar, revogação posterior à prévia, estados de erro e offline, cabeçalhos, telefone internacional e campos com acentos, vírgula e aspas.
- Os cabeçalhos seguem a documentação de importação do Google Contatos.

## Pendências antes de publicar

- Abrir o app de testes com sessão real de gestor e confirmar o fluxo no navegador, inclusive acesso por unidade.
- Importar o CSV fictício em uma conta Google de testes e conferir telefone e rótulo.
