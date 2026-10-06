import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Search,
  RefreshCw,
  Star,
  Activity,
  Trophy,
} from "lucide-react";
import SearchableSelect from "../SearchableSelect";
import MatchCard from "./MatchCard";
import MatchAnalysis from "./MatchAnalysis";
import { asMatches, sportsRequest } from "./api";
import { finished, live, normalizeSearch, saoPauloDate } from "./analysis";
import { useWatchlist } from "./useWatchlist";
import type { Match } from "./types";
import "./sports.css";
export default function SportsPage({ userId }: { userId: string }) {
  const [day, setDay] = useState(() => saoPauloDate()),
    [query, setQuery] = useState(""),
    [country, setCountry] = useState("all"),
    [league, setLeague] = useState("all"),
    [status, setStatus] = useState("all"),
    [favorites, setFavorites] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]),
    [selected, setSelected] = useState<Match | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [configured, setConfigured] = useState<boolean | null>(null),
    [fetchedAt, setFetchedAt] = useState<string | null>(null),
    [remaining, setRemaining] = useState<number | null>(null),
    [warning, setWarning] = useState(""),
    [loadedDay, setLoadedDay] = useState("");
  const requestId = useRef(0);
  const watch = useWatchlist(userId);
  async function load(date: string) {
    const id = ++requestId.current;
    setBusy(true);
    setError("");
    setWarning("");
    try {
      const r = await sportsRequest("fixtures", { date });
      if (id !== requestId.current) return;
      setMatches(asMatches(r));
      setLoadedDay(date);
      setFetchedAt(r.fetchedAt);
      setRemaining(r.remaining);
      setWarning(r.warning || "");
      setConfigured(true);
    } catch (e) {
      if (id === requestId.current) setError((e as Error).message);
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    void sportsRequest("status")
      .then((r) => {
        if (!active) return;
        const s = r.response[0] as { configured: boolean; remaining: number };
        setConfigured(s.configured);
        setRemaining(s.remaining);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
      requestId.current++;
    };
  }, []);
  useEffect(() => {
    setCountry("all");
    setLeague("all");
    if (configured && !favorites) void load(day);
  }, [day, configured, favorites]);
  const available = favorites
    ? watch.items.map(
        (w) => matches.find((m) => m.id === w.match.id) || w.match,
      )
    : loadedDay === day
      ? matches
      : [];
  const countries = [...new Set(available.map((m) => m.country))].sort();
  const leagues = [
    ...new Map(
      available
        .filter((m) => country === "all" || m.country === country)
        .map((m) => [m.leagueId, `${m.league} · ${m.country}`]),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  const visible = useMemo(
    () =>
      available
        .filter(
          (m) =>
            (country === "all" || country === m.country) &&
            (league === "all" || String(m.leagueId) === league) &&
            (status === "all" ||
              (status === "live" && live(m)) ||
              (status === "finished" && finished(m)) ||
              (status === "scheduled" && ["NS", "TBD"].includes(m.status))) &&
            normalizeSearch(
              `${m.home.name} ${m.away.name} ${m.league} ${m.country}`,
            ).includes(normalizeSearch(query)),
        )
        .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff)),
    [available, country, league, status, query],
  );
  const groups = [
    ...new Map(
      visible.map((m) => [m.leagueId, { name: m.league, country: m.country }]),
    ).entries(),
  ];
  if (selected)
    return (
      <MatchAnalysis
        key={selected.id}
        match={selected}
        watchError={watch.error}
        starred={watch.items.some((w) => w.match.id === selected.id)}
        savedNote={watch.notes?.[selected.id] || ""}
        onBack={() => setSelected(null)}
        onStar={() => void watch.toggle(selected)}
        onSaveNote={(note) => watch.saveNote(selected, note)}
      />
    );
  return (
    <div className="sports-central">
      <section className="panel sports-control">
        <div className="sports-control-heading">
          <div>
            <p className="eyebrow">SEU PAINEL DE TRABALHO</p>
            <h2>Encontre seu próximo confronto</h2>
            <p className="muted">
              Calendário, histórico e análise no mesmo lugar.
            </p>
          </div>
          <span className="sports-provider">
            <Activity size={14} />
            {configured === null
              ? "Verificando fonte"
              : configured
                ? "API-Football"
                : "Fonte aguardando ativação"}
          </span>
        </div>
        <div className="sports-calendar">
          <label>
            <span>
              <CalendarDays size={15} />
              Data dos jogos
            </span>
            <input
              type="date"
              value={day}
              disabled={favorites}
              onChange={(e) => {
                if (e.target.value) setDay(e.target.value);
              }}
            />
          </label>
          <div className="segmented">
            {[
              ["Ontem", -1],
              ["Hoje", 0],
              ["Amanhã", 1],
            ].map(([label, offset]) => {
              const d = saoPauloDate(
                new Date(Date.now() + Number(offset) * 86400000),
              );
              return (
                <button
                  key={label}
                  disabled={favorites}
                  className={day === d ? "selected" : ""}
                  onClick={() => setDay(d)}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <button
            aria-pressed={favorites}
            className={favorites ? "selected" : ""}
            onClick={() => setFavorites((v) => !v)}
          >
            <Star size={16} />
            Meus favoritos ({watch.items.length})
          </button>
          <button
            disabled={busy || !configured || favorites}
            onClick={() => void load(day)}
          >
            <RefreshCw size={16} className={busy ? "spin" : ""} />
            Consultar jogos
          </button>
        </div>
        <div className="sports-filters">
          <label className="sports-search">
            Pesquisar
            <div>
              <Search size={17} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Time, seleção, campeonato ou país"
              />
            </div>
          </label>
          <label>
            País
            <SearchableSelect
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setLeague("all");
              }}
            >
              <option value="all">Todos os países</option>
              {countries.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </SearchableSelect>
          </label>
          <label>
            Campeonato
            <SearchableSelect
              value={league}
              onChange={(e) => setLeague(e.target.value)}
            >
              <option value="all">Todos os campeonatos</option>
              {leagues.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </SearchableSelect>
          </label>
          <label>
            Situação
            <SearchableSelect
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">Todas as situações</option>
              <option value="scheduled">Agendados</option>
              <option value="live">Ao vivo</option>
              <option value="finished">Encerrados</option>
            </SearchableSelect>
          </label>
        </div>
      </section>
      {(error || watch.error) && (
        <div className="error" role="alert">
          {error || watch.error}
        </div>
      )}
      {warning && (
        <p className="sports-warning" role="status">
          {warning}
        </p>
      )}
      <div className="sports-summary">
        <span>
          <Trophy size={16} />
          <strong>{groups.length}</strong> campeonatos
        </span>
        <span>
          <CalendarDays size={16} />
          <strong>{visible.length}</strong> jogos
        </span>
        <span>
          <Activity size={16} />
          <strong>{visible.filter(live).length}</strong> ao vivo
        </span>
      </div>
      <p className="sports-source muted">
        {favorites
          ? "Favoritos de todas as datas. Horário e placar correspondem à última consulta salva."
          : "Horários de Brasília · Consultas sob demanda, sem atualização contínua."}
        {!favorites && fetchedAt && loadedDay === day
          ? ` · Consulta: ${new Date(fetchedAt).toLocaleString("pt-BR")}`
          : ""}
        {remaining !== null
          ? ` · ${remaining} consultas disponíveis no orçamento de hoje`
          : ""}
      </p>
      {busy && (
        <div className="panel sports-empty" role="status">
          Consultando jogos de {day.split("-").reverse().join("/")}…
        </div>
      )}
      {!busy && !visible.length && (
        <section className="panel sports-empty">
          <CalendarDays size={34} />
          <h3>
            {configured === false && !favorites
              ? "Sua central está pronta para conectar os jogos"
              : favorites
                ? "Nenhum favorito neste filtro"
                : error
                  ? "Não foi possível carregar os jogos"
                  : "Nenhum jogo encontrado"}
          </h3>
          <p>
            {configured === false && !favorites
              ? "A fonte de dados precisa ser ativada para consultar partidas, histórico e odds reais."
              : favorites
                ? "Marque a estrela nos confrontos que você deseja analisar."
                : "Experimente outra data ou remova os filtros. A disponibilidade depende da cobertura da fonte."}
          </p>
          {(query ||
            country !== "all" ||
            league !== "all" ||
            status !== "all") && (
            <button
              onClick={() => {
                setQuery("");
                setCountry("all");
                setLeague("all");
                setStatus("all");
              }}
            >
              Limpar filtros
            </button>
          )}
        </section>
      )}
      {!busy &&
        groups.map(([id, g]) => (
          <section key={id} className="panel sports-league">
            <header>
              <div>
                <p className="eyebrow">{g.country}</p>
                <h3>{g.name}</h3>
              </div>
              <span className="muted">
                {visible.filter((m) => m.leagueId === id).length} jogos
              </span>
            </header>
            {visible
              .filter((m) => m.leagueId === id)
              .map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  showDate={favorites}
                  starred={watch.items.some((w) => w.match.id === m.id)}
                  onStar={() => void watch.toggle(m)}
                  onOpen={() => setSelected(m)}
                />
              ))}
          </section>
        ))}
    </div>
  );
}
