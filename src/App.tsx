import { bankrollBase, percentOfBase } from "./bankroll";
import SearchableSelect from "./SearchableSelect";
import DashboardPage from "./DashboardPage";
import CatalogPage from "./CatalogPage";
import AnalyticsPage from "./AnalyticsPage";
import BankPage from "./BankPage";
import EntryTable from "./EntryTable";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  ChartNoAxesCombined,
  ListFilter,
  Plus,
  Search,
  Download,
  LogOut,
  Globe2,
  Activity,
  X,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import Auth from "./Auth";
import BetForm from "./BetForm";
import {
  supabase,
  command,
  money,
  date,
  profit,
  statusName,
  type Entry,
  type Ledger,
  type Competition,
} from "./lib";

const pages = [
  ["dashboard", "Visão geral", LayoutDashboard],
  ["entries", "Minhas entradas", ListFilter],
  ["bank", "Minha banca", Wallet],
  ["analytics", "Estatísticas", ChartNoAxesCombined],
  ["catalog", "Competições", Globe2],
] as const;
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState(location.hash.slice(1) || "dashboard");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [catalog, setCatalog] = useState<Competition[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("all");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [deleting, setDeleting] = useState<Entry | null>(null);
  const [detail, setDetail] = useState<Entry | null>(null);
  const [result, setResult] = useState("");
  const [notice, setNotice] = useState("");
  const [mutationRequest, setMutationRequest] = useState(() =>
    crypto.randomUUID(),
  );
  const activeUser = useRef(session?.user.id);
  activeUser.current = session?.user.id;
  useEffect(
    () => setMutationRequest(crypto.randomUUID()),
    [modal, detail?.id, deleting?.id, result],
  );
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setAuthLoading(false);
      })
      .catch(() => setAuthLoading(false));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setModal("password");
    });
    const hash = () => setPage(location.hash.slice(1) || "dashboard");
    window.addEventListener("hashchange", hash);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("hashchange", hash);
    };
  }, []);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (tool: unknown, options: unknown) => unknown;
        };
      }
    ).modelContext;
    if (!context?.registerTool || !session) return;
    const controller = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: "navigate_bet_panel",
            description:
              "Abre uma seção do painel BET sem alterar registros financeiros.",
            inputSchema: {
              type: "object",
              properties: {
                page: {
                  type: "string",
                  enum: [
                    "dashboard",
                    "entries",
                    "bank",
                    "analytics",
                    "catalog",
                  ],
                },
              },
              required: ["page"],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true },
            execute(input: unknown) {
              const p = (input as { page?: unknown })?.page;
              if (typeof p !== "string" || !pages.some((v) => v[0] === p))
                throw new Error("Página inválida");
              location.hash = p;
              setPage(p);
              return { page: p };
            },
          },
          { signal: controller.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => controller.abort();
  }, [session?.user.id]);
  async function load() {
    const owner = activeUser.current;
    setLoading(true);
    setError("");
    try {
      const fetchAll = async (table: string) => {
        let rows: unknown[] = [];
        for (let from = 0; ; from += 1000) {
          let query = supabase.from(table).select("*");
          if (table === "bet_entries") query = query.is("deleted_at", null);
          const r = await query
            .order(table === "bet_catalog" ? "name" : "created_at", {
              ascending: table === "bet_catalog",
            })
            .range(from, from + 999);
          if (r.error) throw r.error;
          rows = rows.concat(r.data);
          if (r.data.length < 1000) break;
        }
        return rows;
      };
      const [e, l, c, w] = await Promise.all([
        fetchAll("bet_entries"),
        fetchAll("bet_ledger"),
        fetchAll("bet_catalog"),
        supabase.from("bet_wallets").select("balance").maybeSingle(),
      ]);
      if (w.error) throw w.error;
      if (owner !== activeUser.current) return;
      setEntries(e as Entry[]);
      setLedger(l as Ledger[]);
      setCatalog(c as Competition[]);
      setBalance(Number(w.data?.balance || 0));
    } catch (e) {
      if (owner === activeUser.current) setError((e as Error).message);
    } finally {
      if (owner === activeUser.current) setLoading(false);
    }
  }
  useEffect(() => {
    if (session) {
      void load();
    } else {
      setEntries([]);
      setLedger([]);
      setBalance(0);
    }
  }, [session?.user.id]);
  useEffect(() => {
    if (!modal && !detail && !editing && !deleting) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        setModal("");
        setDetail(null);
        setEditing(null);
        setDeleting(null);
      }
    };
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>("[role=dialog]");
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !dialog) return;
      const els = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
        ),
      );
      const first = els[0],
        last = els.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    dialog?.querySelector<HTMLElement>("input,button")?.focus();
    document.addEventListener("keydown", trap);
    document.addEventListener("keydown", fn);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", fn);
      document.removeEventListener("keydown", trap);
      previous?.focus();
      document.body.style.overflow = old;
    };
  }, [modal, detail, editing, deleting, busy]);
  const scoped = useMemo(
    () =>
      entries.filter(
        (e) =>
          period === "all" ||
          new Date(e.created_at) >=
            new Date(Date.now() - Number(period) * 86400000),
      ),
    [entries, period],
  );
  const won = scoped.filter((e) => e.status === "won");
  const lost = scoped.filter((e) => e.status === "lost");
  const pnl = scoped.reduce((s, e) => s + profit(e), 0);
  const turnover = won.concat(lost).reduce((s, e) => s + Number(e.stake), 0);
  const rate =
    won.length + lost.length
      ? (won.length / (won.length + lost.length)) * 100
      : 0;
  const exposure = entries
    .filter((e) => e.status === "pending")
    .reduce((s, e) => s + Number(e.stake), 0);
  const deposits = bankrollBase(ledger);
  const bankrollRoi = percentOfBase(pnl, deposits);
  const chart = [
    { date: "Início", balance: 0 },
    ...ledger
      .slice()
      .reverse()
      .map((l) => ({
        date: new Date(l.created_at).toLocaleDateString("pt-BR"),
        balance: Number(l.balance_after),
      })),
  ];
  const filtered = scoped.filter(
    (e) =>
      (filter === "all" || e.status === filter) &&
      `${e.home} ${e.away} ${e.market} ${e.bookmaker}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  function exportCsv() {
    const rows = [
      [
        "Data",
        "Equipe 1",
        "Equipe 2",
        "Mercado",
        "Valor",
        "Odd",
        "Resultado",
        "Lucro",
      ],
      ...filtered.map((e) => [
        date(e.created_at),
        e.home,
        e.away,
        e.market,
        e.stake,
        e.odds,
        statusName[e.status],
        profit(e),
      ]),
    ];
    const csv =
      "\uFEFF" +
      rows
        .map((r) =>
          r
            .map(
              (v) =>
                '"' +
                String(v)
                  .replace(/"/g, '""')
                  .replace(/^[=+@-]/, "'") +
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
    a.download = "bet-entradas.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  const table = (data: Entry[]) => (
    <EntryTable
      data={data}
      catalog={catalog}
      search={page === "entries" ? search : ""}
      filter={page === "entries" ? filter : "all"}
      balance={balance}
      onDetail={(e) => {
        setDetail(e);
        setResult(e.status);
        setNotice("");
      }}
      onEdit={(e) => {
        setDetail(null);
        setEditing(e);
      }}
      onDelete={(e) => {
        setDetail(null);
        setDeleting(e);
        setNotice("");
      }}
      onStart={() => setModal(balance ? "bet" : "deposit")}
    />
  );
  if (authLoading)
    return <div className="loading-screen">Carregando seu painel…</div>;
  if (!session) return <Auth />;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="#dashboard" className="logo">
          b<span>et</span>
          <i />
        </a>
        <p className="nav-label">SEU WORKSPACE</p>
        <nav>
          {pages.map(([id, name, Icon]) => (
            <a key={id} href={"#" + id} className={page === id ? "active" : ""}>
              <Icon size={20} />
              {name}
              {page === id && <span className="nav-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <Activity size={18} />
            <strong>Cada entrada conta.</strong>
            <p>Decisões melhores começam com um histórico organizado.</p>
          </div>
          <button
            className="profile"
            onClick={() => void supabase.auth.signOut()}
          >
            <span className="avatar">
              {session.user.email?.slice(0, 2).toUpperCase()}
            </span>
            <span>
              <strong>Minha conta</strong>
              <small>{session.user.email}</small>
            </span>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <span>
            Workspace <ChevronRight size={14} />{" "}
            <strong>
              {pages.find((p) => p[0] === page)?.[1] || "Visão geral"}
            </strong>
          </span>
          <div>
            <span className="today">
              {new Date().toLocaleDateString("pt-BR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <button
              className="icon-button"
              disabled={loading}
              aria-label="Atualizar dados"
              onClick={() => void load()}
            >
              <RefreshCw size={17} className={loading ? "spin" : ""} />
            </button>
          </div>
        </header>
        <div className="page">
          <div className="page-heading">
            <div>
              <p className="eyebrow">SEUS NÚMEROS, EM PERSPECTIVA</p>
              <h1>
                {page === "dashboard"
                  ? "Visão geral"
                  : pages.find((p) => p[0] === page)?.[1]}
              </h1>
              <p className="muted">
                {page === "dashboard"
                  ? "Acompanhe sua banca. Entenda cada resultado."
                  : page === "entries"
                    ? "Do primeiro registro ao resultado final."
                    : page === "bank"
                      ? "Seu saldo e todas as movimentações."
                      : page === "analytics"
                        ? "Encontre padrões no seu histórico."
                        : "Clubes e seleções prontos para suas entradas."}
              </p>
            </div>
            <button
              className="primary"
              disabled={loading}
              onClick={() => setModal("bet")}
            >
              <Plus size={18} />
              Nova entrada
            </button>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={() => void load()}>Tentar novamente</button>
            </div>
          )}
          {loading && (
            <p role="status" className="muted">
              Atualizando seus dados…
            </p>
          )}
          {(page === "dashboard" || page === "analytics") && (
            <>
              <div className="section-toolbar">
                <span className="muted">Desempenho das entradas</span>
                <SearchableSelect
                  aria-label="Período"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                >
                  <option value="all">Todo o período</option>
                  <option value="7">Últimos 7 dias</option>
                  <option value="30">Últimos 30 dias</option>
                  <option value="90">Últimos 90 dias</option>
                </SearchableSelect>
              </div>
              <div className="stats-grid performance-stats">
                <article className="stat main-stat">
                  <span>
                    Banca disponível
                    <Wallet size={18} />
                  </span>
                  <h2>{money(balance)}</h2>
                  <small>{money(exposure)} em entradas abertas</small>
                </article>
                <article className="stat">
                  <span>
                    Lucro líquido
                    <ArrowUpRight size={18} />
                  </span>
                  <h2 className={pnl < 0 ? "negative" : "positive"}>
                    {money(pnl)}
                  </h2>
                  <small>
                    {won.length + lost.length} entradas com ganho ou perda
                  </small>
                </article>
                <article className="stat">
                  <span>
                    Taxa de acerto
                    <ChartNoAxesCombined size={18} />
                  </span>
                  <h2>
                    {rate.toFixed(1)}
                    <em>%</em>
                  </h2>
                  <small>
                    {won.length} ganhas · {lost.length} perdidas
                  </small>
                </article>
                <article className="stat">
                  <span>
                    ROI das entradas
                    <Activity size={18} />
                  </span>
                  <h2>
                    {(turnover ? (pnl / turnover) * 100 : 0).toFixed(1)}
                    <em>%</em>
                  </h2>
                  <small>Sobre {money(turnover)} liquidados</small>
                </article>
                <article className="stat">
                  <span>
                    ROI sobre a banca
                    <ChartNoAxesCombined size={18} />
                  </span>
                  <h2 className={pnl < 0 ? "negative" : "positive"}>
                    {bankrollRoi === null ? "—" : bankrollRoi.toFixed(1)}
                    {bankrollRoi !== null && <em>%</em>}
                  </h2>
                  <small>Banca inicial + aportes: {money(deposits)}</small>
                </article>
              </div>
            </>
          )}
          {page === "dashboard" && (
            <DashboardPage
              ledger={ledger}
              entries={entries}
              chart={chart}
              won={won}
              lost={lost}
              setModal={setModal}
              table={table}
            />
          )}
          {page === "entries" && (
            <section className="panel">
              <div className="filters">
                <div className="search">
                  <Search size={17} />
                  <input
                    placeholder="Buscar confronto, mercado ou casa…"
                    aria-label="Buscar entradas"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <SearchableSelect
                  aria-label="Resultado"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">Todos os resultados</option>
                  {Object.entries(statusName).map(([v, n]) => (
                    <option value={v} key={v}>
                      {n}
                    </option>
                  ))}
                </SearchableSelect>
                <SearchableSelect
                  aria-label="Período"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                >
                  <option value="all">Todo o período</option>
                  <option value="30">Últimos 30 dias</option>
                  <option value="90">Últimos 90 dias</option>
                </SearchableSelect>
                <button onClick={exportCsv}>
                  <Download size={16} />
                  Exportar CSV
                </button>
              </div>
              {table(filtered)}
              <p className="table-footer">
                {filtered.length} entradas · Valor total{" "}
                {money(filtered.reduce((s, e) => s + Number(e.stake), 0))}
              </p>
            </section>
          )}
          {page === "bank" && (
            <BankPage
              balance={balance}
              exposure={exposure}
              deposits={deposits}
              ledger={ledger}
              setModal={setModal}
            />
          )}
          {page === "analytics" && (
            <AnalyticsPage scoped={scoped} catalog={catalog} />
          )}
          {page === "catalog" && (
            <CatalogPage
              catalog={catalog}
              search={search}
              setSearch={setSearch}
            />
          )}
        </div>
        <footer className="workspace-footer">
          <span>BET / Gestão de banca</span>
          <span>Resultados registrados por você · Valores em BRL</span>
        </footer>
      </main>
      {editing && (
        <BetForm
          key={editing.id}
          entry={editing}
          catalog={catalog}
          balance={balance}
          baseBankroll={deposits}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
      {deleting && (
        <div className="modal-backdrop">
          <section
            className="modal small-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <header>
              <h2 id="delete-title">Apagar entrada?</h2>
              <button
                className="icon-button"
                aria-label="Fechar"
                disabled={busy}
                onClick={() => setDeleting(null)}
              >
                <X />
              </button>
            </header>
            <p>
              {deleting.home} × {deleting.away}
            </p>
            <p className="muted">
              A entrada sairá das listas e estatísticas. O efeito dela na banca
              será revertido, incluindo qualquer retorno recebido. O ajuste
              ficará no extrato.
            </p>
            {notice && (
              <p className="error" role="alert">
                {notice}
              </p>
            )}
            <footer>
              <button disabled={busy} onClick={() => setDeleting(null)}>
                Cancelar
              </button>
              <button
                className="danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setNotice("");
                  try {
                    await command(
                      "delete",
                      { id: deleting.id },
                      mutationRequest,
                    );
                    await load();
                    setDeleting(null);
                  } catch (e) {
                    setNotice((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Apagando…" : "Apagar entrada"}
              </button>
            </footer>
          </section>
        </div>
      )}
      {modal === "bet" && (
        <BetForm
          catalog={catalog}
          balance={balance}
          baseBankroll={deposits}
          onClose={() => setModal("")}
          onSaved={load}
        />
      )}
      {["deposit", "withdraw", "password"].includes(modal) && (
        <div className="modal-backdrop">
          <section
            className="modal small-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="action-title"
          >
            <header>
              <h2 id="action-title">
                {modal === "deposit"
                  ? "Adicionar valor à banca"
                  : modal === "withdraw"
                    ? "Retirar valor da banca"
                    : "Definir nova senha"}
              </h2>
              <button
                className="icon-button"
                aria-label="Fechar"
                onClick={() => {
                  setModal("");
                  setNotice("");
                }}
              >
                <X />
              </button>
            </header>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setNotice("");
                const f = new FormData(e.currentTarget);
                try {
                  if (modal === "password") {
                    const r = await supabase.auth.updateUser({
                      password: String(f.get("password")),
                    });
                    if (r.error) throw r.error;
                  } else {
                    await command(
                      modal,
                      { amount: Number(f.get("amount")) },
                      mutationRequest,
                    );
                    await load();
                  }
                  setModal("");
                } catch (e) {
                  setNotice((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {modal === "password" ? (
                <label>
                  Nova senha
                  <input
                    name="password"
                    type="password"
                    minLength={8}
                    required
                    autoComplete="new-password"
                  />
                </label>
              ) : (
                <>
                  <p className="muted">Disponível agora: {money(balance)}</p>
                  <label>
                    Valor (R$)
                    <input
                      autoFocus
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={modal === "withdraw" ? balance : undefined}
                      required
                      placeholder="0,00"
                    />
                  </label>
                </>
              )}
              {notice && (
                <p className="error" role="alert">
                  {notice}
                </p>
              )}
              <footer>
                <button type="button" onClick={() => setModal("")}>
                  Cancelar
                </button>
                <button disabled={busy} className="primary">
                  {busy ? "Salvando…" : "Confirmar"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
      {detail && (
        <div className="modal-backdrop">
          <section
            className="modal small-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
          >
            <header>
              <div>
                <p className="eyebrow">DETALHES DA ENTRADA</p>
                <h2 id="detail-title">
                  {detail.home} × {detail.away}
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label="Fechar"
                onClick={() => setDetail(null)}
              >
                <X />
              </button>
            </header>
            <p className="muted">
              {catalog.find((c) => c.id === detail.catalog_id)?.name} ·{" "}
              {date(detail.event_at)}
            </p>
            <h3>{detail.market}</h3>
            <div className="return-box">
              <span>
                Valor<strong>{money(Number(detail.stake))}</strong>
              </span>
              <span>
                Odd<strong>{Number(detail.odds).toFixed(3)}</strong>
              </span>
              <span>
                Retorno se ganhar
                <strong className="positive">
                  {money(
                    Math.round(
                      Number(detail.stake) * Number(detail.odds) * 100,
                    ) / 100,
                  )}
                </strong>
              </span>
            </div>
            {detail.bookmaker && <p>Casa: {detail.bookmaker}</p>}
            {detail.notes && <p className="notes">{detail.notes}</p>}
            <label>
              Resultado
              <SearchableSelect
                value={result}
                onChange={(e) => setResult(e.target.value)}
              >
                {Object.entries(statusName).map(([v, n]) => (
                  <option key={v} value={v}>
                    {n}
                  </option>
                ))}
              </SearchableSelect>
            </label>
            <p className="muted">
              Ganha: credita entrada + lucro. Perdida: mantém o débito.
              Reembolsada: devolve a entrada. Ao corrigir, o crédito anterior é
              revertido automaticamente.
            </p>
            {notice && (
              <p className="error" role="alert">
                {notice}
              </p>
            )}
            <footer>
              <button
                onClick={() => {
                  setEditing(detail);
                  setDetail(null);
                }}
              >
                Editar entrada
              </button>
              <button
                className="danger"
                onClick={() => {
                  setDeleting(detail);
                  setDetail(null);
                  setNotice("");
                }}
              >
                Apagar
              </button>
              <button
                className="primary"
                disabled={busy || result === detail.status}
                onClick={async () => {
                  setBusy(true);
                  setNotice("");
                  try {
                    await command(
                      "settle",
                      { id: detail.id, status: result },
                      mutationRequest,
                    );
                    await load();
                    setDetail(null);
                  } catch (e) {
                    setNotice((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Salvando…" : "Salvar resultado"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
