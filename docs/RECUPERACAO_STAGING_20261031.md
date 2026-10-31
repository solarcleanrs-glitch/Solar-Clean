# Recuperação — conferência de 31/10/2026

Não executar restauração sobre produção nem sobre o aparelho de trabalho.

## Cobertura atual observada no código

| Conteúdo | Persistência | Exportar backup atual |
|---|---|---|
| Vistorias e snapshots de conflito | IndexedDB solarCleanDB/vistorias | Sim, conteúdo de dbAll |
| Fotos incorporadas à vistoria | IndexedDB | Sim; referências remotas não são cópia dos arquivos |
| Configurações da empresa/projeto | solarCleanCompany | Sim |
| Agenda e fila pendente | solarCleanAgenda | Não |
| CRM local | solarCleanClients, solarCleanCrmMeta, solarCleanCrmContactHistory | Não |
| Intenção financeira pendente | journal por conta/projeto | Não |
| Fechamentos e recebimentos confirmados | PostgreSQL Supabase | Não |
| Arquivos no bucket vistoria-media | Storage Supabase | Não |

O código atual não oferece importação/restauração do JSON. Validação estrutural
não deve ser apresentada como teste de restauração. Não limpar armazenamento,
reinstalar app ou trocar conta no aparelho de trabalho enquanto houver filas.

## Preparação e critérios de aceitação

1. Guardar JSON local fora do navegador, preservando o original. Verificar com
   `node scripts/verificar-backup-local.cjs caminho-do-backup.json`.
   O verificador só lê e mostra contagens, sem clientes, chaves ou tokens.
2. Confirmar existência e data de backup do banco por mecanismo disponível ao
   projeto. Inventariar arquivos do Storage separadamente; backup do PostgreSQL
   não deve ser assumido como cópia dos bytes das mídias.
3. Preparar ambiente descartável isolado e restauração de teste; nunca usar o
   banco de produção como destino. Não apontar o app staging atual para outro
   projeto: ele possui bloqueio explícito de URL.
4. Comparar contagens e vínculos de agenda, escopos, parceiros, vistorias,
   fechamento/itens/recebimentos. Conferir saldo em centavos, ausência de dois
   vínculos ativos para o mesmo serviço e manutenção dos cancelados no histórico.
5. Conferir acesso aos bytes de fotos/assinaturas e abrir relatórios de amostra.
   Repetir login de gestor e conta sem vínculo no ambiente restaurado.
6. Validar recuperação de fila local sem repetir cobranças ou sobrescrever
   revisões. Preservar IDs de intenções financeiras; não recriar como nova ação.

## Estado

Roteiro e verificador preparados; restauração real não executada. Falta ampliar
cobertura do backup local e definir importação segura com validação de projeto,
conta, prévia e preservação das cópias existentes. Também faltam isolamento local
entre contas, papéis de campo por unidade e concorrência real entre dispositivos.
Aprovação de produção permanece pendente desses critérios.


## Revisão 11 — backup local ampliado, somente staging

Exportar backup preserva os campos app/company/vistorias antigos e acrescenta
stagingLocal v1 apenas no domínio de testes com projeto correto. Guarda textos
originais de agenda/CRM inclusive ilegíveis, e journal financeiro somente da conta
atual com ID estável. Não exporta tokens de acesso/renovação nem journals de outras
contas. Dados legados de agenda/CRM/vistorias ainda são do aparelho, não segregados
por conta: o backup declara essa limitação. Nenhuma autenticação do servidor é
inferida da identidade declarada no arquivo. Comparação antes/depois da leitura
assíncrona interrompe se dados locais/conta mudarem; não é snapshot transacional
entre IndexedDB e localStorage e não garante consistência com gravações remotas.
Não inclui bytes de mídia remota nem livro financeiro completo. Importação e
restauração continuam indisponíveis; validar recuperação antes de produção.
A tabela anterior descreve a cobertura antes desta revisão.
