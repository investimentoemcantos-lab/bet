import {
  MARKETS,
  PERIODS,
  emptyMarket,
  formatLine,
  marketLabel,
  marketLines,
  type MarketValue,
} from "./markets";
export default function MarketPicker({
  value,
  onChange,
  home,
  away,
}: {
  value: MarketValue;
  onChange: (v: MarketValue) => void;
  home: string;
  away: string;
}) {
  const m = MARKETS.find((m) => m.id === value.type);
  const patch = (p: Partial<MarketValue>) => onChange({ ...value, ...p });
  const lined = m && ["total", "handicap", "exact"].includes(m.kind);
  const label = marketLabel(value, home, away);
  return (
    <fieldset className="market-picker full">
      <legend>Mercado da entrada</legend>
      <div className="form-grid">
        <label>
          Mercado
          <select
            required
            value={value.type}
            onChange={(e) =>
              onChange({
                ...emptyMarket(),
                type: e.target.value,
                period: value.period,
                scope: e.target.value === "clean_sheet" ? "home" : "match",
              })
            }
          >
            <option value="">Selecione o mercado</option>
            {MARKETS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        {m && m.kind !== "custom" && m.id !== "half_full" && (
          <label>
            Período
            <select
              value={value.period}
              onChange={(e) => patch({ period: e.target.value })}
            >
              {Object.entries(PERIODS).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
        {m?.scope && (
          <label>
            Aplicar a
            <select
              value={value.scope}
              onChange={(e) => patch({ scope: e.target.value })}
            >
              {m.id !== "clean_sheet" && (
                <option value="match">Total do jogo</option>
              )}
              <option value="home">Equipe 1{home ? " — " + home : ""}</option>
              <option value="away">Equipe 2{away ? " — " + away : ""}</option>
            </select>
          </label>
        )}
        {m?.kind === "total" && (
          <label>
            Mais ou menos
            <select
              required
              value={value.selection}
              onChange={(e) => patch({ selection: e.target.value })}
            >
              <option value="">Selecione a direção</option>
              <option value="over">Mais de (Over)</option>
              <option value="under">Menos de (Under)</option>
            </select>
          </label>
        )}
        {m?.kind === "handicap" && (
          <label>
            Seleção
            <select
              required
              value={value.selection}
              onChange={(e) => patch({ selection: e.target.value })}
            >
              <option value="">Selecione o resultado</option>
              <option value="home">Equipe 1{home ? " — " + home : ""}</option>
              {m.id === "european_handicap" && (
                <option value="draw">Empate</option>
              )}
              <option value="away">Equipe 2{away ? " — " + away : ""}</option>
            </select>
          </label>
        )}
        {lined && (
          <label>
            Linha
            <select
              required
              value={value.line}
              onChange={(e) => patch({ line: e.target.value, customLine: "" })}
            >
              <option value="">Selecione a linha</option>
              {marketLines(m!).map((n) => (
                <option key={n} value={String(n)}>
                  {formatLine(n, m?.kind === "handicap")}
                </option>
              ))}
              <option value="custom">Outra linha…</option>
            </select>
          </label>
        )}
        {lined && value.line === "custom" && (
          <label>
            Linha personalizada
            <input
              type="number"
              required
              step={m?.step ?? 0.25}
              min={
                m?.kind === "handicap"
                  ? undefined
                  : m?.kind === "exact"
                    ? 0
                    : 0.25
              }
              value={value.customLine}
              onChange={(e) => patch({ customLine: e.target.value })}
              placeholder="Ex.: 2,75"
            />
          </label>
        )}
        {m?.kind === "choice" && (
          <label>
            Seleção
            <select
              required
              value={value.selection}
              onChange={(e) => patch({ selection: e.target.value })}
            >
              <option value="">Selecione a opção</option>
              {m.choices?.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
        {m?.kind === "score" && (
          <>
            <label>
              Gols da equipe 1
              <input
                type="number"
                min="0"
                max="30"
                step="1"
                required
                value={value.homeScore}
                onChange={(e) => patch({ homeScore: e.target.value })}
              />
            </label>
            <label>
              Gols da equipe 2
              <input
                type="number"
                min="0"
                max="30"
                step="1"
                required
                value={value.awayScore}
                onChange={(e) => patch({ awayScore: e.target.value })}
              />
            </label>
          </>
        )}
        {m?.kind === "custom" && (
          <label className="full">
            Descrição do mercado
            <input
              required
              value={value.description}
              maxLength={200}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="Descreva o mercado, seleção e linha"
            />
          </label>
        )}
      </div>
      {m?.kind === "total" && (
        <p className="muted market-help">
          Linhas de 0,25 em 0,25: 0,5 · 0,75 · 1 · 1,25…
        </p>
      )}
      {m?.id === "european_handicap" && (
        <p className="muted market-help">
          A linha é aplicada à equipe 1. Escolha o resultado após esse ajuste.
        </p>
      )}
      {label && (
        <div className="market-preview">
          <span>Entrada selecionada</span>
          <output aria-label="Entrada selecionada">{label}</output>
        </div>
      )}
    </fieldset>
  );
}
