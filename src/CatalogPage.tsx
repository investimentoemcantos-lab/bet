import { selectableCatalog } from "./catalog";
import { lazy, Suspense, type ReactNode } from "react";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  ChartNoAxesCombined,
  Plus,
  Search,
  Globe2,
  Activity,
  ChevronRight,
} from "lucide-react";
import {
  money,
  date,
  profit,
  statusName,
  type Entry,
  type Ledger,
  type Competition,
} from "./lib";

export default function CatalogPage({
  catalog,
  search,
  setSearch,
}: {
  catalog: Competition[];
  search: string;
  setSearch: (s: string) => void;
}) {
  catalog = selectableCatalog(catalog);
  return (
    <>
      <div className="catalog-toolbar">
        <div className="search">
          <Search size={17} />
          <input
            aria-label="Buscar competição ou equipe"
            placeholder="Buscar país, competição ou equipe…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="muted">{catalog.length} competições cadastradas</span>
      </div>
      <div className="catalog-grid">
        {catalog
          .filter((c) =>
            `${c.country} ${c.name} ${c.teams.join(" ")}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .map((c) => (
            <article className="panel catalog-card" key={c.id}>
              <span className="eyebrow">
                {c.kind === "clubs" ? "CLUBES" : "SELEÇÕES"} · {c.country}
              </span>
              <h3>{c.name}</h3>
              <p className="muted">
                {c.teams.length} equipes · Importado em{" "}
                {new Date(c.updated_at + "T12:00:00").toLocaleDateString(
                  "pt-BR",
                )}
              </p>
              <details>
                <summary>Ver equipes</summary>
                <div className="team-chips">
                  {c.teams.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              </details>
              <a target="_blank" rel="noreferrer" href={c.source}>
                Fonte do catálogo <ArrowUpRight size={14} />
              </a>
            </article>
          ))}
      </div>
    </>
  );
}
