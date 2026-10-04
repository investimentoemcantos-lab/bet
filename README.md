# BET — Gestão de banca e entradas

Painel em português para acompanhar apostas esportivas de futebol. React, TypeScript, Vite e Supabase. Login por e-mail/senha, recuperação de senha e registros isolados por usuário.

## Executar

Node 24. Copie `.env.example` para `.env`, execute `npm ci` e `npm run dev`. `npm test` valida o formulário e autenticação em DOM simulado. `npm run build` valida TypeScript e gera `dist/`, compatível com hospedagem estática. As variáveis VITE são públicas; nunca use service_role ou chave secreta no frontend.

## Funcionalidades

- Visão geral: banca disponível, lucro líquido, taxa de acerto, ROI e evolução do saldo.
- Entradas: clubes/seleções, país, competição, confronto, mercado, valor, odd, data, casa e notas.
- Histórico: busca, filtros por resultado/período, detalhes, correção de resultado e exportação CSV.
- Banca: aportes, retiradas e extrato imutável.
- Estatísticas por competição e catálogo com origem/data de importação.

## Regras financeiras

Valores em BRL, NUMERIC no banco, arredondamento em centavos. A entrada debita a stake imediatamente. Vitória credita stake × odd (inclui stake); derrota não altera o débito; reembolso credita somente a stake. Corrigir resultado reverte o crédito anterior antes de aplicar o novo. Saldo negativo é recusado. A banca disponível exclui o dinheiro em aberto; patrimônio exibido soma saldo + stake aberta. Lucro/ROI consideram apenas ganhas e perdidas, excluindo reembolsos e entradas abertas. ROI = lucro / volume das apostas ganhas e perdidas.

Todas as mutações passam pelo RPC `bet_command`, que chama função privada com usuário derivado de `auth.uid()`, bloqueio de carteira, transação e idempotência. O cliente não pode escrever em carteiras, extrato ou apostas diretamente. Todas as tabelas têm RLS. Nunca editar um saldo diretamente para reconciliar: usar aportes/retiradas.

## Supabase

As migrations em `supabase/migrations` já foram aplicadas ao projeto conectado. `supabase/tests/financial.sql` testa as regras e isolamento em uma transação com rollback, sem persistir dados de teste. Configure **Authentication → URL Configuration** com a URL de produção em Site URL e Redirect URLs para confirmação de e-mail e recuperação de senha. O cadastro respeita a confirmação de e-mail configurada no projeto.

## Catálogo

Importação real de equipes/competições via Football-Data.co.uk e Mart Jürisoo (`international_results`, CC0). O catálogo ativo contém 31 competições de clubes e 52 de seleções. É um snapshot, não uma API de placares ao vivo. Clubes usam a temporada mais recente disponível. Seleções seguem competição → seleção 1 → seleção 2, sem filtro por país-sede. Competições históricas por sede foram desativadas para novos registros, preservando entradas existentes. As competições foram unificadas e traduzidas, e as ligas A–D da UEFA 2026/27 usam a composição oficial. Amistosos agregam todas as seleções observadas desde 2024, em vez de limitar o confronto ao histórico de uma sede. A cobertura é a das fontes, não todas as ligas do mundo. Fonte pública: https://www.football-data.co.uk/all_new_data.php e https://github.com/martj42/international_results.

Para atualizar: `python scripts/import-catalog.py` e `python scripts/build-seed.py`; para unificar seleções, use `node scripts/build-national-catalog.mjs`; revise o catálogo e gere uma nova migration com Supabase CLI antes de aplicar mudanças. Não reexecute uma migration já aplicada com conteúdo diferente. Nenhuma API paga ou chave de fornecedor é necessária.
