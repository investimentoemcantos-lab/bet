import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChartNoAxesCombined,
  Download,
  ArrowUpRight,
  Filter,
  X,
  ChevronRight,
} from "lucide-react";
import { money, date, statusName, type Entry, type Competition } from "./lib";
import {
  dimensions,
  groupEntries,
  marketFamily,
  metrics,
  normalizeSearch,
  netProfit,
  type Dimension,
  type Group,
} from "./analytics";
import SearchableSelect from "./SearchableSelect";
const percent = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)}%`);
const number = (v: number | null) => (v === null ? "—" : v.toFixed(2));
const signed = (v: number) =>
  v < 0 ? "negative" : v > 0 ? "positive" : "muted";
export default function AnalyticsPage({
  entries,
  catalog,
  baseBankroll,
  onDetail,
}: {
  entries: Entry[];
  catalog: Competition[];
  baseBankroll: number;
  onDetail: (e: Entry) => void;
}) {
  const [dimension, setDimension] = useState<Dimension>("market");
  const [period, setPeriod] = useState("all"),
    [start, setStart] = useState(""),
    [end, setEnd] = useState("");
  const [kind, setKind] = useState("all"),
    [league, setLeague] = useState("all"),
    [market, setMarket] = useState("all"),
    [team, setTeam] = useState("all"),
    [bookmaker, setBookmaker] = useState("all");
  const [minimum, setMinimum] = useState("1"),
    [sort, setSort] = useState("net_desc"),
    [search, setSearch] = useState("");
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const competitions = useMemo(
    () => new Map(catalog.map((c) => [c.id, c])),
    [catalog],
  );
  const options = useMemo(
    () => ({
      markets: [...new Set(entries.map(marketFamily))].sort(),
      teams: [...new Set(entries.flatMap((e) => [e.home, e.away]))].sort(),
      leagues: [...new Set(entries.map((e) => e.catalog_id))],
      houses: [
        ...new Set(entries.map((e) => e.bookmaker.trim() || "Não informada")),
      ].sort(),
    }),
    [entries],
  );
  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        const created = new Date(e.created_at),
          day = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}-${String(created.getDate()).padStart(2, "0")}`;
        return (
          (period === "all" ||
            created.getTime() >= Date.now() - Number(period) * 86400000) &&
          (!start || day >= start) &&
          (!end || day <= end) &&
          (kind === "all" || competitions.get(e.catalog_id)?.kind === kind) &&
          (league === "all" || e.catalog_id === league) &&
          (market === "all" || marketFamily(e) === market) &&
          (team === "all" || e.home === team || e.away === team) &&
          (bookmaker === "all" ||
            (e.bookmaker.trim() || "Não informada") === bookmaker)
        );
      }),
    [
      entries,
      period,
      start,
      end,
      kind,
      league,
      market,
      team,
      bookmaker,
      competitions,
    ],
  );
  const summary = useMemo(() => metrics(filtered), [filtered]);
  const groups = useMemo(
    () => groupEntries(filtered, dimension, catalog),
    [filtered, dimension, catalog],
  );
  const eligible = groups.filter((g) => g.settled >= Number(minimum || 0));
  const rows = eligible
    .filter((g) => normalizeSearch(g.label).includes(normalizeSearch(search)))
    .sort((a, b) => {
      const [field, direction] = sort.split("_");
      const v = (g: Group) =>
        field === "net"
          ? g.net
          : field === "roi"
            ? g.roi
            : field === "accuracy"
              ? g.accuracy
              : field === "total"
                ? g.total
                : field === "won"
                  ? g.won
                  : g.lost;
      if (v(a) === null)
        return v(b) === null ? a.label.localeCompare(b.label, "pt-BR") : 1;
      if (v(b) === null) return -1;
      return (
        (v(a)! - v(b)!) * (direction === "asc" ? 1 : -1) ||
        a.label.localeCompare(b.label, "pt-BR")
      );
    });
  const best = [...eligible]
      .filter((g) => g.net > 0)
      .sort((a, b) => b.net - a.net)[0],
    worst = [...eligible]
      .filter((g) => g.net < 0)
      .sort((a, b) => a.net - b.net)[0];
  const mostWon = [...eligible]
      .filter((g) => g.won > 0)
      .sort((a, b) => b.won - a.won || b.net - a.net)[0],
    mostLost = [...eligible]
      .filter((g) => g.lost > 0)
      .sort((a, b) => b.lost - a.lost || a.net - b.net)[0];
  const detailRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (detailKey)
      detailRef.current?.scrollIntoView?.({
        behavior: "smooth",
        block: "start",
      });
  }, [detailKey]);
  const detail = groups.find((g) => g.key === detailKey);
  const monthly = useMemo(() => {
    const buckets = new Map<string, Entry[]>();
    for (const e of filtered) {
      const d = new Date(e.created_at),
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(e);
    }
    return [...buckets]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, data]) => ({ label, ...metrics(data) }));
  }, [filtered]);
  function reset() {
    setPeriod("all");
    setStart("");
    setEnd("");
    setKind("all");
    setLeague("all");
    setMarket("all");
    setTeam("all");
    setBookmaker("all");
    setSearch("");
    setMinimum("1");
    setDetailKey(null);
  }
  function exportCsv() {
    const matrix = [
      [
        "Grupo",
        "Entradas",
        "Ganhas",
        "Perdidas",
        "Reembolsadas",
        "Abertas",
        "Volume liquidado",
        "Ganhos líquidos",
        "Perdas",
        "Lucro líquido",
        "ROI %",
        "Acerto %",
        "Odd média",
        "Stake média",
      ],
      ...rows.map((g) => [
        g.label,
        g.total,
        g.won,
        g.lost,
        g.refunded,
        g.pending,
        g.volume,
        g.gains,
        g.losses,
        g.net,
        g.roi ?? "",
        g.accuracy ?? "",
        g.averageOdds ?? "",
        g.averageStake ?? "",
      ]),
    ];
    const csv =
      "\uFEFF" +
      matrix
        .map((row) =>
          row
            .map(
              (v) =>
                '"' +
                String(v)
                  .replace(/^[=+@-]/, "'")
                  .replaceAll('"', '""') +
                '"',
            )
            .join(";"),
        )
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `bet-analise-${dimension}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const select = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    values: [string, string][],
  ) => (
    <label>
      {label}
      <SearchableSelect
        aria-label={label}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setDetailKey(null);
        }}
      >
        {values.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </SearchableSelect>
    </label>
  );
  return (
    <div className="analytics-page">
      <section className="panel analytics-filters">
        <div className="panel-heading">
          <h3>
            <Filter size={17} /> Filtrar análise
          </h3>
          <button onClick={reset}>Limpar filtros</button>
        </div>
        <div className="analytics-filter-grid">
          {select(
            "Período da análise",
            period,
            (v) => {
              setPeriod(v);
              setStart("");
              setEnd("");
            },
            [
              ["all", "Todo o histórico"],
              ["7", "Últimos 7 dias"],
              ["30", "Últimos 30 dias"],
              ["90", "Últimos 90 dias"],
            ],
          )}
          <label>
            De
            <input
              type="date"
              aria-label="Data inicial"
              value={start}
              max={end || undefined}
              onChange={(e) => {
                setStart(e.target.value);
                setPeriod("all");
                setDetailKey(null);
              }}
            />
          </label>
          <label>
            Até
            <input
              type="date"
              aria-label="Data final"
              value={end}
              min={start || undefined}
              onChange={(e) => {
                setEnd(e.target.value);
                setPeriod("all");
                setDetailKey(null);
              }}
            />
          </label>
          {select("Tipo de confronto", kind, setKind, [
            ["all", "Clubes e seleções"],
            ["clubs", "Clubes"],
            ["national", "Seleções"],
          ])}
          {select("Liga", league, setLeague, [
            ["all", "Todas as ligas"],
            ...options.leagues.map(
              (id) =>
                [id, competitions.get(id)?.name ?? id] as [string, string],
            ),
          ])}
          {select("Mercado", market, setMarket, [
            ["all", "Todos os mercados"],
            ...options.markets.map((v) => [v, v] as [string, string]),
          ])}
          {select("Time ou seleção", team, setTeam, [
            ["all", "Todos os times"],
            ...options.teams.map((v) => [v, v] as [string, string]),
          ])}
          {select("Casa de apostas", bookmaker, setBookmaker, [
            ["all", "Todas as casas"],
            ...options.houses.map((v) => [v, v] as [string, string]),
          ])}
        </div>
        <p className="muted analysis-method">
          Datas consideram o registro da entrada. Filtros são combinados e
          atualizam toda a página.
        </p>
      </section>
      <div className="stats-grid analytics-summary">
        <article className="stat">
          <span>
            Lucro líquido
            <ArrowUpRight size={17} />
          </span>
          <h2 className={signed(summary.net)}>{money(summary.net)}</h2>
          <small>
            Ganhos {money(summary.gains)} · perdas {money(summary.losses)}
          </small>
        </article>
        <article className="stat">
          <span>ROI das entradas</span>
          <h2>{percent(summary.roi)}</h2>
          <small>Sobre {money(summary.volume)} liquidados</small>
        </article>
        <article className="stat">
          <span>ROI sobre a banca</span>
          <h2>
            {percent(
              baseBankroll > 0 ? (summary.net / baseBankroll) * 100 : null,
            )}
          </h2>
          <small>Inicial + aportes: {money(baseBankroll)}</small>
        </article>
        <article className="stat">
          <span>Taxa de acerto</span>
          <h2>{percent(summary.accuracy)}</h2>
          <small>
            {summary.won} ganhas · {summary.lost} perdidas
          </small>
        </article>
      </div>
      <div className="analysis-strip">
        <span>
          <strong>{summary.total}</strong> entradas filtradas
        </span>
        <span>
          <strong>{summary.pending}</strong> abertas · {money(summary.exposure)}
        </span>
        <span>
          <strong>{summary.refunded}</strong> reembolsadas
        </span>
        <span>
          Odd média <strong>{number(summary.averageOdds)}</strong>
        </span>
        <span>
          Stake média{" "}
          <strong>
            {summary.averageStake === null ? "—" : money(summary.averageStake)}
          </strong>
        </span>
        <span>
          Maior queda de lucro <strong>{money(summary.maxDrawdown)}</strong>
        </span>
      </div>
      <section className="panel">
        <div className="analysis-heading">
          <div>
            <p className="eyebrow">ONDE ESTÃO SEUS RESULTADOS</p>
            <h3>Comparar desempenho</h3>
          </div>
          <button onClick={exportCsv} disabled={!rows.length}>
            <Download size={16} />
            Exportar análise
          </button>
        </div>
        <div
          className="analysis-tabs"
          role="tablist"
          aria-label="Dimensão da análise"
        >
          {Object.entries(dimensions).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={dimension === id}
              className={dimension === id ? "selected" : ""}
              onClick={() => {
                setDimension(id as Dimension);
                setDetailKey(null);
                setSearch("");
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="analysis-controls">
          <label>
            Pesquisar grupo
            <input
              aria-label="Pesquisar grupo"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Digite para encontrar…"
            />
          </label>
          {select("Ordenar por", sort, setSort, [
            ["net_desc", "Maior lucro"],
            ["net_asc", "Maior prejuízo"],
            ["roi_desc", "Maior ROI"],
            ["roi_asc", "Menor ROI"],
            ["won_desc", "Mais vitórias"],
            ["lost_desc", "Mais derrotas"],
            ["accuracy_desc", "Maior acerto"],
            ["total_desc", "Mais entradas"],
          ])}
          <label>
            Mínimo de liquidadas
            <input
              aria-label="Mínimo de liquidadas"
              type="number"
              min="0"
              step="1"
              value={minimum}
              onChange={(e) => setMinimum(e.target.value)}
            />
          </label>
        </div>
        {dimension === "team" && (
          <p className="analysis-note">
            Cada entrada aparece nos dois participantes do confronto. Este
            ranking mede jogos envolvendo o time; não significa que você apostou
            na vitória dele. Os totais dos times não devem ser somados.
          </p>
        )}
        <div className="analysis-rankings">
          {[
            {
              title: "Maior lucro líquido",
              group: best,
              value: best ? money(best.net) : "—",
              tone: "positive",
            },
            {
              title: "Maior prejuízo líquido",
              group: worst,
              value: worst ? money(worst.net) : "—",
              tone: "negative",
            },
            {
              title: "Mais entradas ganhas",
              group: mostWon,
              value: mostWon ? `${mostWon.won} vitórias` : "—",
              tone: "positive",
            },
            {
              title: "Mais entradas perdidas",
              group: mostLost,
              value: mostLost ? `${mostLost.lost} derrotas` : "—",
              tone: "negative",
            },
          ].map((r) => (
            <button
              className="analysis-ranking"
              key={r.title}
              disabled={!r.group}
              onClick={() => setDetailKey(r.group!.key)}
            >
              <span>{r.title}</span>
              <strong className={r.tone}>{r.value}</strong>
              <b>{r.group?.label ?? "Sem resultados neste recorte"}</b>
              <small>
                {r.group
                  ? `${r.group.settled} liquidadas · ROI ${percent(r.group.roi)}`
                  : "Aguardando entradas liquidadas"}
              </small>
            </button>
          ))}
        </div>
        <p className="analysis-note">
          {rows.length} grupos · Clique em um grupo para conferir as entradas.
          ROI e acerto usam apenas ganhas e perdidas; abertas e reembolsadas
          aparecem nas contagens. O mínimo de liquidadas afeta os rankings e a
          tabela, sem alterar o resumo.
        </p>
        {rows.length ? (
          <div className="table-scroll">
            <table className="analysis-table">
              <thead>
                <tr>
                  {[
                    "Grupo",
                    "Entradas",
                    "Ganhas",
                    "Perdidas",
                    "Reemb.",
                    "Abertas",
                    "Volume liquidado",
                    "Ganhos líquidos",
                    "Perdas",
                    "Lucro líquido",
                    "ROI",
                    "Acerto",
                    "Odd média",
                    "Stake média",
                  ].map((t) => (
                    <th key={t}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr key={g.key}>
                    <td>
                      <button
                        className="group-link"
                        onClick={() => setDetailKey(g.key)}
                      >
                        {g.label}
                        <ChevronRight size={15} />
                      </button>
                      <small>
                        {g.settled < 10
                          ? "Amostra pequena: menos de 10 liquidadas"
                          : `${g.settled} entradas liquidadas`}
                      </small>
                    </td>
                    <td>{g.total}</td>
                    <td className="positive">{g.won}</td>
                    <td className="negative">{g.lost}</td>
                    <td>{g.refunded}</td>
                    <td>{g.pending}</td>
                    <td>{money(g.volume)}</td>
                    <td className="positive">{money(g.gains)}</td>
                    <td className="negative">{money(g.losses)}</td>
                    <td className={signed(g.net)}>{money(g.net)}</td>
                    <td>{percent(g.roi)}</td>
                    <td>{percent(g.accuracy)}</td>
                    <td>{number(g.averageOdds)}</td>
                    <td>
                      {g.averageStake === null ? "—" : money(g.averageStake)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <ChartNoAxesCombined />
            <h3>Nenhum grupo para este recorte</h3>
            <p>Ajuste os filtros ou o mínimo de entradas liquidadas.</p>
          </div>
        )}
      </section>
      {detail && (
        <section
          ref={detailRef}
          className="panel analysis-detail"
          aria-label="Entradas do grupo"
        >
          <div className="panel-heading">
            <div>
              <p className="eyebrow">ABRIR OS NÚMEROS</p>
              <h3>{detail.label}</h3>
              <p className="muted">
                {detail.total} entradas · lucro {money(detail.net)} · ROI{" "}
                {percent(detail.roi)}
              </p>
            </div>
            <button
              aria-label="Fechar entradas do grupo"
              onClick={() => setDetailKey(null)}
            >
              <X size={17} />
            </button>
          </div>
          <div className="analysis-strip">
            <span>
              Maior ganho{" "}
              <strong>
                {detail.best === null ? "—" : money(Math.max(0, detail.best))}
              </strong>
            </span>
            <span>
              Maior perda{" "}
              <strong>
                {detail.worst === null
                  ? "—"
                  : money(Math.abs(Math.min(0, detail.worst)))}
              </strong>
            </span>
            <span>
              Maior stake <strong>{money(detail.maxStake)}</strong>
            </span>
            <span>
              Maior queda de lucro <strong>{money(detail.maxDrawdown)}</strong>
            </span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    "Confronto / mercado",
                    "Registrada em",
                    "Valor",
                    "Odd",
                    "Resultado",
                    "Lucro",
                    "",
                  ].map((t, i) => (
                    <th key={i}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...detail.entries]
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))
                  .map((e) => (
                    <tr key={e.id}>
                      <td>
                        <strong>
                          {e.home} × {e.away}
                        </strong>
                        <small>
                          {e.market} · {competitions.get(e.catalog_id)?.name}
                        </small>
                      </td>
                      <td>{date(e.created_at)}</td>
                      <td>{money(Number(e.stake))}</td>
                      <td>{Number(e.odds).toFixed(3)}</td>
                      <td>
                        <span className={"badge " + e.status}>
                          {statusName[e.status]}
                        </span>
                      </td>
                      <td className={signed(netProfit(e))}>
                        {e.status === "pending" ? "—" : money(netProfit(e))}
                      </td>
                      <td>
                        <button
                          aria-label={"Detalhar " + e.home + " × " + e.away}
                          onClick={() => onDetail(e)}
                        >
                          <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="panel">
        <div className="panel-heading">
          <h3>Evolução mensal dos resultados</h3>
          <span className="muted">Meses de registro</span>
        </div>
        {monthly.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    "Mês",
                    "Ganhas / perdidas",
                    "Lucro líquido",
                    "ROI",
                    "Acerto",
                    "Comparação",
                  ].map((t) => (
                    <th key={t}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthly.map((m) => (
                  <tr key={m.label}>
                    <td>{m.label.split("-").reverse().join("/")}</td>
                    <td>
                      {m.won} / {m.lost}
                    </td>
                    <td className={signed(m.net)}>{money(m.net)}</td>
                    <td>{percent(m.roi)}</td>
                    <td>{percent(m.accuracy)}</td>
                    <td>
                      <div
                        className="analysis-bar"
                        aria-label={`Lucro do mês: ${money(m.net)}`}
                      >
                        <span
                          className={m.net < 0 ? "loss" : "gain"}
                          style={{
                            width: `${(Math.abs(m.net) / Math.max(1, ...monthly.map((x) => Math.abs(x.net)))) * 100}%`,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="analysis-note">Nenhuma entrada neste período.</p>
        )}
      </section>
      <p className="muted analysis-method">
        Ganhos líquidos: lucro das entradas ganhas, sem a devolução da stake.
        Perdas: stakes das entradas perdidas. Lucro líquido = ganhos − perdas.
        ROI = lucro / volume liquidado. Maior queda de lucro: queda acumulada
        desde um pico, em ordem de liquidação. Rankings descrevem seu histórico;
        amostras pequenas podem variar bastante.
      </p>
    </div>
  );
}
