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

export default function AnalyticsPage({
  scoped,
  catalog,
}: {
  scoped: Entry[];
  catalog: Competition[];
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h3>Desempenho por competição</h3>
        <span className="muted">Ganhas e perdidas</span>
      </div>
      {scoped.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Competição</th>
                <th>Entradas</th>
                <th>Acerto</th>
                <th>Lucro</th>
                <th>ROI</th>
              </tr>
            </thead>
            <tbody>
              {[...new Set(scoped.map((e) => e.catalog_id))].map((id) => {
                const all = scoped.filter((e) => e.catalog_id === id);
                const settled = all.filter(
                  (e) => e.status === "won" || e.status === "lost",
                );
                const p = settled.reduce((s, e) => s + profit(e), 0);
                const vol = settled.reduce((s, e) => s + Number(e.stake), 0);
                return (
                  <tr key={id}>
                    <td>
                      <strong>{catalog.find((c) => c.id === id)?.name}</strong>
                      <small>{catalog.find((c) => c.id === id)?.country}</small>
                    </td>
                    <td>{all.length}</td>
                    <td>
                      {(settled.length
                        ? (settled.filter((e) => e.status === "won").length /
                            settled.length) *
                          100
                        : 0
                      ).toFixed(1)}
                      %
                    </td>
                    <td className={p >= 0 ? "positive" : "negative"}>
                      {money(p)}
                    </td>
                    <td>{(vol ? (p / vol) * 100 : 0).toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          <ChartNoAxesCombined />
          <h3>Seus resultados vão revelar padrões</h3>
          <p>Registre entradas para comparar seu desempenho por competição.</p>
        </div>
      )}
    </section>
  );
}
