import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Star } from "lucide-react";
import HistoryAnalysis from "./HistoryAnalysis";
import OddsPanel from "./OddsPanel";
import { asMatches, sportsRequest } from "./api";
import { matchDate, matchTime, normalizeStats, statusLabel } from "./analysis";
import type { Match, MatchStats } from "./types";
export default function MatchAnalysis({
  match: m,
  savedNote,
  watchError,
  starred,
  onBack,
  onStar,
  onSaveNote,
}: {
  match: Match;
  savedNote: string;
  watchError?: string;
  starred: boolean;
  onBack: () => void;
  onStar: () => void;
  onSaveNote: (note: string) => Promise<boolean>;
}) {
  const [tab, setTab] = useState("history"),
    [home, setHome] = useState<Match[]>([]),
    [away, setAway] = useState<Match[]>([]),
    [stats, setStats] = useState<MatchStats>({}),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [note, setNote] = useState(savedNote),
    [noteStatus, setNoteStatus] = useState(""),
    [fetchedAt, setFetchedAt] = useState<string | null>(null),
    [warning, setWarning] = useState("");
  const noteDirty = useRef(false);
  useEffect(() => {
    if (!noteDirty.current) setNote(savedNote);
  }, [savedNote]);
  const [h2h, setH2h] = useState<Match[] | null>(null);
  const [statsFetchedAt, setStatsFetchedAt] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      sportsRequest("history", { team: m.home.id }),
      sportsRequest("history", { team: m.away.id }),
    ]).then((results) => {
      if (!active) return;
      const errors: string[] = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled") {
          (i === 0 ? setHome : setAway)(asMatches(r.value));
          setFetchedAt(r.value.fetchedAt);
          if (r.value.warning) setWarning(r.value.warning);
        } else
          errors.push(
            `${i === 0 ? m.home.name : m.away.name}: ${(r.reason as Error).message}`,
          );
      });
      setError(errors.join(" · "));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [m.id, m.home.id, m.away.id]);
  async function loadStatistics(ids: number[]) {
    setBusy(true);
    setError("");
    try {
      const r = await sportsRequest("statistics", { fixtures: ids });
      const parsed: MatchStats = {};
      for (const value of r.response) {
        const item = value as { fixture: number; response: unknown[] };
        if (item?.fixture && Array.isArray(item.response))
          parsed[item.fixture] = normalizeStats(item.response);
      }
      setStats((old) => ({ ...old, ...parsed }));
      setStatsFetchedAt(r.fetchedAt);
      if (r.warning) setWarning(r.warning);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function loadH2h() {
    setBusy(true);
    setError("");
    try {
      const r = await sportsRequest("h2h", {
        home: m.home.id,
        away: m.away.id,
      });
      setH2h(asMatches(r));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="sports-analysis">
      <div className="sports-analysis-toolbar">
        <button onClick={onBack}>
          <ArrowLeft size={16} />
          Voltar aos jogos
        </button>
        <button aria-pressed={starred} onClick={onStar}>
          <Star size={16} fill={starred ? "currentColor" : "none"} />
          {starred ? "Nos favoritos" : "Favoritar jogo"}
        </button>
      </div>
      <section className="panel sports-confrontation">
        <p className="eyebrow">
          {m.country} / {m.league} · {m.season}
        </p>
        <div className="sports-scoreboard">
          <h2>{m.home.name}</h2>
          <div>
            <strong>
              {m.homeGoals ?? "—"} <span>×</span> {m.awayGoals ?? "—"}
            </strong>
            <small>{statusLabel(m)}</small>
          </div>
          <h2>{m.away.name}</h2>
        </div>
        <p className="muted">
          {matchDate(m.kickoff)} às {matchTime(m.kickoff)} · Brasília
          {m.venue ? ` · ${m.venue}` : ""}
          {m.round ? ` · ${m.round}` : ""}
        </p>
        <p className="muted">Transmissão: ainda não integrada.</p>
      </section>
      <div className="sports-tabs" role="tablist" aria-label="Análise do jogo">
        {[
          ["history", "Histórico e estatísticas"],
          ["match", "Estatísticas do confronto"],
          ["h2h", "Confrontos diretos"],
          ["odds", "Odds"],
          ["notes", "Minha análise"],
        ].map(([id, label]) => (
          <button
            key={id}
            id={`tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {(error || watchError) && (
        <div className="error" role="alert">
          {error || watchError}
        </div>
      )}
      {warning && (
        <p className="sports-warning" role="status">
          {warning}
        </p>
      )}
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "history" && (
          <>
            {loading ? (
              <div className="panel sports-empty" role="status">
                Carregando os resultados das equipes…
              </div>
            ) : (
              <>
                <p className="sports-source muted">
                  Fonte: API-Football · Histórico consultado em{" "}
                  {fetchedAt
                    ? new Date(fetchedAt).toLocaleString("pt-BR")
                    : "—"}
                  . Frequências históricas não são probabilidades garantidas.
                </p>
                <div className="sports-history-grid">
                  <HistoryAnalysis
                    team={m.home}
                    matches={home}
                    stats={stats}
                    before={m.kickoff}
                    leagueId={m.leagueId}
                    onStatistics={(ids) => void loadStatistics(ids)}
                    busy={busy}
                  />
                  <HistoryAnalysis
                    team={m.away}
                    matches={away}
                    stats={stats}
                    before={m.kickoff}
                    leagueId={m.leagueId}
                    onStatistics={(ids) => void loadStatistics(ids)}
                    busy={busy}
                  />
                </div>
              </>
            )}
          </>
        )}
        {tab === "match" && (
          <section className="panel sports-match-stats">
            <header className="sports-section-header">
              <h3>Estatísticas disponíveis para esta partida</h3>
              <button
                disabled={busy}
                onClick={() => void loadStatistics([m.id])}
              >
                {busy ? "Consultando…" : "Consultar estatísticas"}
              </button>
            </header>
            <p className="muted">
              Atualização manual.{" "}
              {statsFetchedAt
                ? `Consulta salva: ${new Date(statsFetchedAt).toLocaleString("pt-BR")}. `
                : ""}
              Antes do jogo, a fonte pode não ter estatísticas. Sem rastreamento
              de posição da bola nesta etapa.
            </p>
            {Object.hasOwn(stats, m.id) ? (
              stats[m.id].length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Indicador</th>
                        <th>{m.home.name}</th>
                        <th>{m.away.name}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ["corners", "Escanteios"],
                          ["shots", "Chutes"],
                          ["onTarget", "Chutes no alvo"],
                          ["possession", "Posse (%)"],
                          ["yellow", "Cartões amarelos"],
                          ["red", "Cartões vermelhos"],
                        ] as const
                      ).map(([key, label]) => (
                        <tr key={key}>
                          <td>{label}</td>
                          <td>
                            {stats[m.id].find((s) => s.teamId === m.home.id)?.[
                              key
                            ] ?? "—"}
                          </td>
                          <td>
                            {stats[m.id].find((s) => s.teamId === m.away.id)?.[
                              key
                            ] ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="sports-empty">
                  A fonte não retornou estatísticas para esta partida.
                </div>
              )
            ) : null}
          </section>
        )}
        {tab === "h2h" && (
          <section className="panel sports-h2h">
            <header className="sports-section-header">
              <h3>Confrontos diretos anteriores</h3>
              <button disabled={busy} onClick={() => void loadH2h()}>
                {busy ? "Consultando…" : "Consultar confrontos"}
              </button>
            </header>
            <p className="muted">
              Até 50 confrontos retornados pela fonte; partidas posteriores ao
              jogo analisado são excluídas.
            </p>
            {h2h !== null && (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Campeonato</th>
                      <th>Confronto</th>
                      <th>Placar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {h2h
                      .filter((v) => new Date(v.kickoff) < new Date(m.kickoff))
                      .map((v) => (
                        <tr key={v.id}>
                          <td>{matchDate(v.kickoff)}</td>
                          <td>{v.league}</td>
                          <td>
                            {v.home.name} × {v.away.name}
                          </td>
                          <td>
                            {v.homeGoals ?? "—"} × {v.awayGoals ?? "—"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!h2h.filter((v) => new Date(v.kickoff) < new Date(m.kickoff))
                  .length && (
                  <p className="sports-empty">
                    Sem confrontos anteriores na consulta.
                  </p>
                )}
              </div>
            )}
          </section>
        )}
        {tab === "odds" && <OddsPanel fixture={m.id} />}
        {tab === "notes" && (
          <section className="panel sports-notes">
            <h3>Sua leitura do confronto</h3>
            <p className="muted">
              Salve seus critérios, mercados observados e motivos para entrar ou
              descartar. Salvar a análise também adiciona o jogo aos favoritos.
            </p>
            <label>
              Análise
              <textarea
                maxLength={5000}
                rows={8}
                value={note}
                onChange={(e) => {
                  noteDirty.current = true;
                  setNote(e.target.value);
                  setNoteStatus("");
                }}
                placeholder="O que chamou sua atenção neste jogo?"
              />
            </label>
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const ok = await onSaveNote(note);
                setNoteStatus(
                  ok
                    ? "Análise salva."
                    : "Não foi possível salvar. Tente novamente.",
                );
                setBusy(false);
              }}
            >
              Salvar análise
            </button>
            <p role="status">{noteStatus}</p>
          </section>
        )}
      </div>
    </div>
  );
}
