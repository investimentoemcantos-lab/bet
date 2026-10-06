# Central de jogos — etapa 1

Integração API-Football v3 sob demanda, por Edge Function Supabase autenticada. Nenhuma chave esportiva ou service_role entra no bundle Vite. Não altera tabelas, RPCs ou saldos financeiros.

## Ativar

1. Aplicar `supabase/migrations/20261006201758_sports_workspace.sql` e `20261006203112_sports_preserve_analysis.sql`.
2. Publicar a função `bet-sports` com verificação JWT habilitada.
3. Criar uma conta em https://dashboard.api-football.com/register e obter a chave em Account → My Access.
4. No projeto Supabase, **Edge Functions → Secrets**, adicionar `API_FOOTBALL_KEY`. Nunca colocar essa chave em uma variável `VITE_` ou no Git.
5. `SPORTS_DAILY_BUDGET` é opcional, padrão **80** chamadas por dia UTC, teto 7.500. Só aumentar após conferir o plano. O limite inclui tentativas que falharam e usa reserva atômica no banco. O cache não consome novas chamadas do fornecedor.
6. Validar com uma conta real: data atual, ligas usadas, último histórico, cantos, chutes e odds. O plano gratuito pode restringir a temporada atual; não há fallback de dados fictícios.

## Operação e cobertura

Agenda em cache por 5 minutos, histórico/H2H por 6 horas, estatísticas individuais por 5 minutos, odds por 15 minutos. Sem polling, agendamento ou assinatura paga. Botões consultam o cache enquanto válido; não furam TTL. Estatísticas individuais nesta etapa são um snapshot manual, não um acompanhamento de jogo em tempo real.

As reservas limitam o projeto a 10 chamadas por minuto e impedem consultas simultâneas do mesmo endpoint por 30 segundos. Falhas preservam resultados anteriores, claramente marcados como desatualizados. Se o orçamento acabar, cache válido/antigo segue disponível, mas consultas inéditas aguardam o próximo dia UTC.

Histórico consulta até 100 resultados recentes por equipe e aplica: partidas encerradas, anteriores ao confronto, competição/mando e, então, limite 5/10/20/50. Amostras menores mostram a quantidade real. Não há garantia de 50 jogos em casa/fora dentro dos 100 resultados retornados. AET/PEN usam `score.fulltime` nos indicadores de gols/resultados (90 minutos); se esse campo estiver ausente, a partida fica fora da amostra. Estatísticas de cantos/chutes retornadas pela fonte podem incluir prorrogação e isso é indicado na interface. Frequências exibidas são histórico de gols totais, não probabilidades, nem liquidação de linhas asiáticas.

Estatísticas de cantos/chutes são carregadas explicitamente em lotes de até 10. Nulos não viram zero; cada métrica mostra cobertura. Ausência de estatística é armazenada por 5 minutos; não inventar valores. Odds possuem casa, mercado, seleção/linha, timestamp da fonte e paginação explícita. CoinPoker e mercados de cantos precisam ser validados na conta do fornecedor.

Favoritos e notas ficam em `bet_sports_watchlist`, com CRUD restrito ao dono por RLS. Remover um favorito desativa `is_favorite` e preserva suas notas. Cache e consumo são server-only. A função valida JWT com Auth e verifica que o usuário tem carteira BET; não aceita URL externa, chave fornecida pelo cliente ou proxy arbitrário.

## Próximas etapas

- Vincular partida à entrada por IDs oficiais, com mapeamento revisado do catálogo atual (não aproximar nomes automaticamente).
- Sala ao vivo, eventos, partidas fixadas, atualização optativa e timestamps por feed.
- Cobertura de transmissões brasileiras validada em fonte separada.
- Regras de alerta, comparações de odds e snapshots de análise na entrada.

Nesta entrega não há TV, rastreamento da bola, alertas automáticos ou liquidação de entradas por placar.
