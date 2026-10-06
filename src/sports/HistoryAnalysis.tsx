import { useState } from "react";
import SearchableSelect from "../SearchableSelect";
import { matchDate, regulationScore, sample, summarize } from "./analysis";
import type { Match, MatchStats, Team, VenueFilter } from "./types";
const number = (n: number | null, suffix = "") =>
  n === null
    ? "—"
    : n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + suffix;
export default function HistoryAnalysis({
  team,
  error,
  matches,
  stats,
  before,
  leagueId,
  onStatistics,
  busy,
}: {
  team: Team;
  error?: string;
  matches: Match[];
  stats: MatchStats;
  before: string;
  leagueId: number;
  onStatistics: (ids: number[]) => void;
  busy: boolean;
}) {
  const [metric, setMetric] = useState("goals");
  const [size, setSize] = useState(10),
    [venue, setVenue] = useState<VenueFilter>("all"),
    [competition, setCompetition] = useState("all");
  const selected = sample(matches, team.id, {
    size,
    venue,
    leagueId: competition === "all" ? null : Number(competition),
    before,
  });
  const s = summarize(selected, team.id, stats);
  const missing = selected.filter((m) => !Object.hasOwn(stats, m.id));
  const leagues = [
    ...new Map(matches.map((m) => [m.leagueId, m.league])).entries(),
  ];
  if (!leagues.some(([id]) => id === leagueId))
    leagues.push([leagueId, "Campeonato deste confronto"]);
  return (
    <section className="panel sports-history">
      <header className="sports-section-header">
        <div>
          <p className="eyebrow">HISTÓRICO DA EQUIPE</p>
          <h3>{team.name}</h3>
        </div>
        <span className="sports-sample">
          {error ? "Consulta indisponível" : `${s.count} de ${size} jogos`}
        </span>
      </header>
      <div className="sports-history-filters">
        <label>
          Amostra
          <SearchableSelect
            value={String(size)}
            onChange={(e) => setSize(Number(e.target.value))}
          >
            {[5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>
                Últimos {n} jogos
              </option>
            ))}
          </SearchableSelect>
        </label>
        <label>
          Mando
          <SearchableSelect
            value={venue}
            onChange={(e) => setVenue(e.target.value as VenueFilter)}
          >
            <option value="all">Casa e fora</option>
            <option value="home">Somente em casa</option>
            <option value="away">Somente fora</option>
          </SearchableSelect>
        </label>
        <label>
          Competição
          <SearchableSelect
            value={competition}
            onChange={(e) => setCompetition(e.target.value)}
          >
            <option value="all">Todas as competições</option>
            {leagues.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </SearchableSelect>
        </label>
      </div>
      <details className="sports-data-details"><summary>Como o histórico é calculado</summary><p className="muted sports-method">
        Amostra anterior ao confronto, filtrada antes de selecionar os últimos{" "}
        {size}. Gols e resultados nos 90 minutos. Estatísticas de partidas com
        prorrogação podem incluir o tempo extra. O histórico usa a temporada selecionada; o histórico acessível depende do plano e da
        cobertura.
      </p></details>
      {error ? <div className="sports-history-error" role="alert"><h3>Não foi possível consultar o histórico</h3><p>{error}</p><p>Escolha outra temporada acima ou tente atualizar o histórico.</p></div> : s.count ? (
        <>
          <div className="sports-form">
            <b className="positive">{s.wins} vitórias</b>
            <b>{s.draws} empates</b>
            <b className="negative">{s.losses} derrotas</b>
          </div>
          <div className="sports-metric-picker" aria-label="Indicadores do histórico">
            {[["goals", "Gols"], ["corners", "Escanteios"], ["shots", "Chutes"]].map(([id, label]) => <button key={id} aria-pressed={metric === id} onClick={() => setMetric(id)}>{label}</button>)}
          </div>
          <div className="sports-metrics">
            {[
              ["Gols marcados", number(s.scored), `${s.count} jogos`],
              ["Gols sofridos", number(s.conceded), `${s.count} jogos`],
              ["Ambas marcam", number(s.btts, "%"), `${s.count} jogos`],
              [
                "Sem sofrer gol",
                number(s.cleanSheets, "%"),
                `${s.count} jogos`,
              ],
              [
                "Escanteios a favor",
                number(s.corners),
                `${s.cornerCount} jogos com dados`,
              ],
              [
                "Escanteios contra",
                number(s.cornersAgainst),
                `${selected.filter((m) => stats[m.id]?.some((v) => v.teamId !== team.id && v.corners !== null)).length} jogos com dados`,
              ],
              ["Chutes", number(s.shots), `${s.shotCount} jogos com dados`],
              [
                "Chutes no alvo",
                number(s.onTarget),
                `${s.onTargetCount} jogos com dados`,
              ],
            ].filter((_, i) => metric === "goals" ? i < 4 : metric === "corners" ? i >= 4 && i < 6 : i >= 6).map(([label, value, coverage]) => (
              <div key={label}>
                <small>{label}</small>
                <strong>{value}</strong>
                <small>{coverage}</small>
              </div>
            ))}
          </div>
          {metric === "goals" && <div className="sports-lines">
            {[0.5, 1.5, 2.5, 3.5].map((line) => (
              <span key={line}>
                Mais de {number(line)} gols{" "}
                <strong>{number(s.over(line), "%")}</strong>
              </span>
            ))}
          </div>}
          {metric === "corners" && <><div className="sports-lines">
            {[8.5, 9.5, 10.5, 11.5].map((line) => (
              <span key={line}>
                Mais de {number(line)} cantos{" "}
                <strong>{number(s.cornersOver(line), "%")}</strong>
              </span>
            ))}
          </div>
          <p className="muted sports-method">
            Linhas de cantos: {s.totalCornerCount} partidas com estatísticas das
            duas equipes.
          </p></>}
          {metric !== "goals" && <div className="sports-stat-load">
            <p className="muted">
              Médias de cantos e chutes consideram somente partidas com dados.
              Valores ausentes não são zero. Estatísticas carregadas ficam em
              cache.
            </p>
            <button
              disabled={busy || !missing.length}
              onClick={() =>
                onStatistics(missing.slice(0, 10).map((m) => m.id))
              }
            >
              {busy
                ? "Consultando…"
                : missing.length
                  ? `Carregar estatísticas de ${Math.min(10, missing.length)} jogos`
                  : "Estatísticas consultadas"}
            </button>
          </div>}
          <details className="sports-results-details"><summary>Ver os {s.count} resultados da amostra</summary><div className="table-scroll">
            <table className="sports-results">
              <thead>
                <tr>
                  <th>Data / competição</th>
                  <th>Confronto</th>
                  <th>Placar</th>
                  <th>Resultado</th>
                  <th>Cantos</th>
                </tr>
              </thead>
              <tbody>
                {selected.map((m) => {
                  const [hg, ag] = regulationScore(m);
                  const a = (m.home.id === team.id ? hg : ag)!,
                    b = (m.home.id === team.id ? ag : hg)!;
                  return (
                    <tr key={m.id}>
                      <td>
                        {matchDate(m.kickoff)}
                        <small>{m.league}</small>
                      </td>
                      <td>
                        {m.home.name}
                        <small>{m.away.name}</small>
                      </td>
                      <td>
                        {hg} × {ag}
                      </td>
                      <td
                        className={a > b ? "positive" : a < b ? "negative" : ""}
                      >
                        {a > b ? "Vitória" : a < b ? "Derrota" : "Empate"}
                      </td>
                      <td>
                        {number(
                          stats[m.id]?.find((s) => s.teamId === m.home.id)
                            ?.corners ?? null,
                        )}{" "}
                        ×{" "}
                        {number(
                          stats[m.id]?.find((s) => s.teamId === m.away.id)
                            ?.corners ?? null,
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div></details>
        </>
      ) : (
        <div className="sports-empty">
          <h3>Sem resultados nesta amostra</h3>
          <p>
            Não há partidas anteriores ao confronto nesta temporada e nestes filtros. Escolha outra temporada ou amplie os filtros.
          </p>
        </div>
      )}
    </section>
  );
}
