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

export default function BankPage({
  balance,
  exposure,
  deposits,
  ledger,
  setModal,
}: {
  balance: number;
  exposure: number;
  deposits: number;
  ledger: Ledger[];
  setModal: (v: string) => void;
}) {
  return (
    <>
      <div className="bank-hero">
        <div>
          <p>BANCA DISPONÍVEL</p>
          <h2>{money(balance)}</h2>
          <span>
            Patrimônio com valores em aberto: {money(balance + exposure)}
          </span>
        </div>
        <div>
          <button className="primary" onClick={() => setModal("deposit")}>
            <Plus size={18} />
            Adicionar valor
          </button>
          <button onClick={() => setModal("withdraw")}>
            <ArrowUpRight size={18} />
            Retirar valor
          </button>
        </div>
      </div>
      <div className="stats-grid bank-stats">
        <article className="stat">
          <span>Total de aportes</span>
          <h2>{money(deposits)}</h2>
        </article>
        <article className="stat">
          <span>Total de retiradas</span>
          <h2>
            {money(
              -ledger
                .filter((l) => l.kind === "withdraw")
                .reduce((s, l) => s + Number(l.amount), 0),
            )}
          </h2>
        </article>
        <article className="stat">
          <span>Valor em aberto</span>
          <h2>{money(exposure)}</h2>
        </article>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h3>Extrato da banca</h3>
          <span className="muted">{ledger.length} movimentações</span>
        </div>
        {ledger.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Movimentação</th>
                  <th>Data</th>
                  <th>Valor</th>
                  <th>Saldo após</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <div className="ledger-name">
                        {Number(l.amount) >= 0 ? (
                          <ArrowDownLeft size={18} />
                        ) : (
                          <ArrowUpRight size={18} />
                        )}
                        <span>{l.description}</span>
                      </div>
                    </td>
                    <td className="muted">{date(l.created_at)}</td>
                    <td
                      className={
                        Number(l.amount) >= 0 ? "positive" : "negative"
                      }
                    >
                      {money(Number(l.amount))}
                    </td>
                    <td>{money(Number(l.balance_after))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <Wallet />
            <h3>Adicione seu saldo inicial</h3>
            <p>Todo aporte, retirada e resultado ficará registrado aqui.</p>
            <button className="primary" onClick={() => setModal("deposit")}>
              Adicionar banca
            </button>
          </div>
        )}
      </section>
    </>
  );
}
