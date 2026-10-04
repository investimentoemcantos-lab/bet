import { money } from "./lib";
import { validCashout } from "./settlement";
export default function CashoutFields({
  stake,
  value,
  onChange,
}: {
  stake: number;
  value: string;
  onChange: (v: string) => void;
}) {
  const net = validCashout(value)
    ? Math.round((Number(value) - stake) * 100) / 100
    : null;
  return (
    <div className="cashout-fields">
      <label>
        Valor recebido no encerramento (R$)
        <input
          aria-label="Valor recebido no encerramento (R$)"
          type="number"
          min="0"
          step="0.01"
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ex.: 7,00"
        />
      </label>
      <p className="muted">
        Informe o valor total recebido da casa, incluindo a parte devolvida da
        entrada.
      </p>
      {net !== null && (
        <div className="return-box">
          <span>
            Volta para a banca<strong>{money(Number(value))}</strong>
          </span>
          <span>
            {net < 0 ? "Prejuízo" : net > 0 ? "Lucro" : "Resultado"}
            <strong
              className={net < 0 ? "negative" : net > 0 ? "positive" : "muted"}
            >
              {money(net)}
            </strong>
          </span>
        </div>
      )}
    </div>
  );
}
