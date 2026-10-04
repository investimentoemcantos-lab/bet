import { isWin, isLoss } from "./settlement";
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
const BalanceChart = lazy(() => import("./BalanceChart"));
export default function DashboardPage({
  ledger,
  entries,
  chart,
  won,
  lost,
  setModal,
  table,
}: {
  ledger: Ledger[];
  entries: Entry[];
  chart: { date: string; balance: number }[];
  won: Entry[];
  lost: Entry[];
  setModal: (v: string) => void;
  table: (e: Entry[]) => ReactNode;
}) {
  won = entries.filter(isWin);
  lost = entries.filter(isLoss);
  return (
    <>
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h3>Evolução da banca</h3>
              <p className="muted">Saldo disponível após cada movimentação</p>
            </div>
            <span className="chart-legend">Saldo</span>
          </div>
          {ledger.length ? (
            <Suspense
              fallback={<div className="chart-empty">Carregando gráfico…</div>}
            >
              <BalanceChart data={chart} />
            </Suspense>
          ) : (
            <div className="chart-empty">
              <ChartNoAxesCombined size={42} />
              <p>A evolução aparecerá após seu primeiro aporte.</p>
              <button onClick={() => setModal("deposit")}>
                Adicionar banca
              </button>
            </div>
          )}
        </section>
        <section className="panel overview">
          <div className="panel-heading">
            <h3>Panorama das entradas</h3>
          </div>
          <div
            className="donut"
            style={{
              background: `conic-gradient(#bbf86a 0 ${entries.length ? (won.length / entries.length) * 360 : 0}deg,#ff7777 0 ${entries.length ? ((won.length + lost.length) / entries.length) * 360 : 0}deg,#333d32 0 360deg)`,
            }}
          >
            <div>
              <strong>{entries.length}</strong>
              <span>entradas</span>
            </div>
          </div>
          <div className="status-summary">
            {Object.entries(statusName).map(([s, n]) => (
              <div key={s}>
                <span>
                  <i className={s} />
                  {n}
                </span>
                <strong>{entries.filter((e) => e.status === s).length}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Entradas recentes</h3>
            <p className="muted">Seu histórico, sempre ao alcance.</p>
          </div>
          <a href="#entries" className="text-link">
            Ver todas <ChevronRight size={16} />
          </a>
        </div>
        {table(entries.slice(0, 5))}
      </section>
    </>
  );
}
