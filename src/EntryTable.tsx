import { Activity, ChevronRight } from "lucide-react";
import {
  money,
  date,
  profit,
  statusName,
  type Entry,
  type Competition,
} from "./lib";
export default function EntryTable({
  data,
  catalog,
  search,
  filter,
  balance,
  onDetail,
  onStart,
}: {
  data: Entry[];
  catalog: Competition[];
  search: string;
  filter: string;
  balance: number;
  onDetail: (e: Entry) => void;
  onStart: () => void;
}) {
  return data.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Confronto / entrada</th>
            <th>Data</th>
            <th>Valor</th>
            <th>Odd</th>
            <th>Resultado</th>
            <th>Lucro líquido</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data.map((e) => (
            <tr key={e.id}>
              <td>
                <strong>
                  {e.home} <span className="versus">×</span> {e.away}
                </strong>
                <small>
                  {e.market} ·{" "}
                  {catalog.find((c) => c.id === e.catalog_id)?.name}
                </small>
              </td>
              <td className="muted">{date(e.event_at)}</td>
              <td>{money(Number(e.stake))}</td>
              <td>
                <span className="odd">{Number(e.odds).toFixed(2)}</span>
              </td>
              <td>
                <span className={"badge " + e.status}>
                  {statusName[e.status]}
                </span>
              </td>
              <td
                className={
                  profit(e) > 0
                    ? "positive"
                    : profit(e) < 0
                      ? "negative"
                      : "muted"
                }
              >
                {e.status === "pending" ? "—" : money(profit(e))}
              </td>
              <td>
                <button
                  className="icon-button"
                  aria-label={"Detalhar " + e.home + " × " + e.away}
                  onClick={() => onDetail(e)}
                >
                  <ChevronRight size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="empty">
      <Activity size={32} />
      <h3>
        {search || filter !== "all"
          ? "Nenhuma entrada encontrada"
          : "Sua história começa aqui"}
      </h3>
      <p>
        {search || filter !== "all"
          ? "Ajuste a busca ou os filtros."
          : "Adicione sua banca e registre a primeira entrada."}
      </p>
      {!search && filter === "all" && (
        <button className="primary" onClick={onStart}>
          {balance ? "Registrar entrada" : "Adicionar banca"}
        </button>
      )}
    </div>
  );
}
