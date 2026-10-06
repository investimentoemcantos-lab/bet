import { useState } from "react";
import SearchableSelect from "../SearchableSelect";
import { asOdds, sportsRequest } from "./api";
import type { OddsRow } from "./types";
export default function OddsPanel({ fixture }: { fixture: number }) {
  const [rows, setRows] = useState<OddsRow[]>([]),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [book, setBook] = useState("all"),
    [market, setMarket] = useState("all"),
    [updated, setUpdated] = useState<string | null>(null),
    [pages, setPages] = useState(1),
    [page, setPage] = useState(0);
  async function load(next = 1) {
    setBusy(true);
    setError("");
    try {
      const r = await sportsRequest("odds", { fixture, page: next });
      const result = asOdds(r);
      setRows((old) => (next === 1 ? result : [...old, ...result]));
      setUpdated(r.fetchedAt);
      setPages(r.paging?.total || 1);
      setPage(next);
      setLoaded(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const selected = rows.filter(
    (r) =>
      (book === "all" || r.bookmaker === book) &&
      (market === "all" || r.market === market),
  );
  return (
    <section className="panel sports-odds">
      <header className="sports-section-header">
        <div>
          <p className="eyebrow">COTAÇÕES DO JOGO</p>
          <h3>Compare as cotações</h3>
        </div>
        <button disabled={busy} onClick={() => void load()}>
          {busy ? "Consultando…" : "Consultar cotações"}
        </button>
      </header>
      <p className="muted">
        Consulta sob demanda, sem atualização automática. A cobertura de casas,
        mercados e linhas depende do fornecedor. Confira a odd na sua casa antes
        de registrar.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loaded && (
        <>
          <div className="sports-history-filters">
            <label>
              Casa
              <SearchableSelect
                value={book}
                onChange={(e) => setBook(e.target.value)}
              >
                <option value="all">Todas as casas</option>
                {[...new Set(rows.map((r) => r.bookmaker))].sort().map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </SearchableSelect>
            </label>
            <label>
              Mercado
              <SearchableSelect
                value={market}
                onChange={(e) => setMarket(e.target.value)}
              >
                <option value="all">Todos os mercados</option>
                {[...new Set(rows.map((r) => r.market))].sort().map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </SearchableSelect>
            </label>
          </div>
          <p className="muted">
            Consulta:{" "}
            {updated ? new Date(updated).toLocaleString("pt-BR") : "—"} · Página{" "}
            {page} de {pages}
          </p>
          {selected.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Casa</th>
                    <th>Mercado</th>
                    <th>Seleção / linha</th>
                    <th>Cotação</th>
                    <th>Atualização da fonte</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.map((r, i) => (
                    <tr key={i}>
                      <td>{r.bookmaker}</td>
                      <td>{r.market}</td>
                      <td>{r.selection}</td>
                      <td>
                        <strong>{r.odd.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </td>
                      <td>
                        {r.updated
                          ? new Date(r.updated).toLocaleString("pt-BR")
                          : "Não informada"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="sports-empty">
              Nenhuma cotação disponível para esta consulta.
            </div>
          )}
          {page < pages && (
            <button disabled={busy} onClick={() => void load(page + 1)}>
              Carregar próxima página
            </button>
          )}
        </>
      )}
    </section>
  );
}
