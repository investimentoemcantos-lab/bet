import { percentOfBase, stakeFromPercent } from "./bankroll";
import SearchableSelect from "./SearchableSelect";
import { competitionsFor } from "./catalog";
import MarketPicker from "./MarketPicker";
import { emptyMarket, marketLabel } from "./markets";
import { useState } from "react";
import { X, Check, ChevronRight } from "lucide-react";
import { command, money, type Competition, type Entry } from "./lib";
const isMain = (name: string) =>
  /^(Liga das Nações|Copa do Mundo|Eliminatórias|Copa América|Eurocopa|Copa da Ásia|Copa Africana|Copa Ouro|Amistosos)/.test(
    name,
  );
export default function BetForm({
  catalog,
  balance,
  baseBankroll = 0,
  onClose,
  onSaved,
  entry,
}: {
  entry?: Entry;
  catalog: Competition[];
  balance: number;
  baseBankroll?: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [market, setMarket] = useState(emptyMarket);
  const originalCompetition = catalog.find((c) => c.id === entry?.catalog_id);
  const [changeMarket, setChangeMarket] = useState(!entry);
  const [kind, setKind] = useState(originalCompetition?.kind ?? "clubs");
  const [country, setCountry] = useState(originalCompetition?.country ?? "");
  const [league, setLeague] = useState(entry?.catalog_id ?? "");
  const [home, setHome] = useState(entry?.home ?? "");
  const [away, setAway] = useState(entry?.away ?? "");
  const [stake, setStake] = useState(entry ? String(entry.stake) : "");
  const [stakePercent, setStakePercent] = useState(
    entry && baseBankroll > 0
      ? String(
          Number(percentOfBase(Number(entry.stake), baseBankroll)!.toFixed(4)),
        )
      : "",
  );
  const [odds, setOdds] = useState(entry ? String(entry.odds) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [request] = useState(crypto.randomUUID());
  const countries = [
    ...new Set(catalog.filter((c) => c.kind === kind).map((c) => c.country)),
  ].sort();
  const leagues = competitionsFor(catalog, kind, country);
  if (
    originalCompetition &&
    league === originalCompetition.id &&
    !leagues.some((c) => c.id === league)
  )
    leagues.push(originalCompetition);
  const selected = catalog.find((c) => c.id === league);
  return (
    <div className="modal-backdrop">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="bet-title"
        className="modal"
      >
        <header>
          <div>
            <p className="eyebrow">REGISTRO DE ENTRADA</p>
            <h2 id="bet-title">
              {entry ? "Editar entrada" : "Qual é a sua entrada?"}
            </h2>
          </div>
          <button
            autoFocus
            className="icon-button"
            aria-label="Fechar"
            onClick={onClose}
          >
            <X />
          </button>
        </header>
        <div className="steps">
          <span className="active">1. Confronto</span>
          <ChevronRight size={14} />
          <span>2. Aposta</span>
          <ChevronRight size={14} />
          <span>3. Registrar</span>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              const label = changeMarket
                ? marketLabel(market, home, away)
                : entry?.market;
              if (!label)
                throw new Error(
                  "Selecione o mercado e preencha a seleção e a linha.",
                );
              await command(
                entry ? "edit" : "place",
                {
                  ...(entry ? { id: entry.id } : {}),
                  catalog_id: league,
                  home,
                  away,
                  stake: Number(stake),
                  odds: Number(odds),
                  market: label,
                  bookmaker: String(f.get("bookmaker")),
                  notes: String(f.get("notes")),
                  event_at: new Date(String(f.get("event_at"))).toISOString(),
                },
                request,
              );
              await onSaved();
              onClose();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="segmented">
            <button
              type="button"
              className={kind === "clubs" ? "selected" : ""}
              onClick={() => {
                setKind("clubs");
                setCountry("");
                setLeague("");
                setHome("");
                setAway("");
              }}
            >
              Clubes
            </button>
            <button
              type="button"
              className={kind === "national" ? "selected" : ""}
              onClick={() => {
                setKind("national");
                setCountry("");
                setLeague("");
                setHome("");
                setAway("");
              }}
            >
              Seleções
            </button>
          </div>
          <div className="form-grid">
            {kind === "clubs" && (
              <label>
                País
                <SearchableSelect
                  required
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    setLeague("");
                    setHome("");
                    setAway("");
                  }}
                >
                  <option value="">Selecione o país</option>
                  {countries.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </SearchableSelect>
              </label>
            )}
            <label className={kind === "national" ? "full" : undefined}>
              Competição
              <SearchableSelect
                required
                disabled={kind === "clubs" && !country}
                value={league}
                onChange={(e) => {
                  setLeague(e.target.value);
                  setHome("");
                  setAway("");
                }}
              >
                <option value="">Selecione a competição</option>
                {kind === "national" ? (
                  <>
                    <optgroup label="Principais competições">
                      {leagues
                        .filter((c) => isMain(c.name))
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Outras competições">
                      {leagues
                        .filter((c) => !isMain(c.name))
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </optgroup>
                  </>
                ) : (
                  leagues.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))
                )}
              </SearchableSelect>
            </label>
            <label>
              {kind === "national" ? "Seleção 1" : "Equipe 1"}
              <SearchableSelect
                required
                disabled={!league}
                value={home}
                onChange={(e) => setHome(e.target.value)}
              >
                <option value="">
                  {kind === "national"
                    ? "Selecione a seleção"
                    : "Selecione a equipe"}
                </option>
                {selected?.teams
                  .filter((t) => t !== away)
                  .map((t) => (
                    <option key={t}>{t}</option>
                  ))}
              </SearchableSelect>
            </label>
            <label>
              {kind === "national" ? "Seleção 2" : "Equipe 2"}
              <SearchableSelect
                required
                disabled={!league}
                value={away}
                onChange={(e) => setAway(e.target.value)}
              >
                <option value="">
                  {kind === "national"
                    ? "Selecione a seleção"
                    : "Selecione a equipe"}
                </option>
                {selected?.teams
                  .filter((t) => t !== home)
                  .map((t) => (
                    <option key={t}>{t}</option>
                  ))}
              </SearchableSelect>
            </label>
            {entry && (
              <div className="full">
                <p>Mercado atual: {entry.market}</p>
                <label className="market-change">
                  <input
                    type="checkbox"
                    checked={changeMarket}
                    onChange={(e) => setChangeMarket(e.target.checked)}
                  />
                  Alterar mercado e linha
                </label>
              </div>
            )}
            {changeMarket && (
              <MarketPicker
                value={market}
                onChange={setMarket}
                home={home}
                away={away}
              />
            )}
            <label>
              Valor da entrada (R$)
              <input
                type="number"
                min="0.01"
                max={entry ? undefined : balance}
                step="0.01"
                required
                value={stake}
                onChange={(e) => {
                  setStake(e.target.value);
                  setStakePercent(
                    e.target.value && baseBankroll > 0
                      ? String(
                          Number(
                            percentOfBase(
                              Number(e.target.value),
                              baseBankroll,
                            )!.toFixed(4),
                          ),
                        )
                      : "",
                  );
                }}
                placeholder="0,00"
              />
            </label>
            <label>
              Stake (% da banca base)
              <input
                aria-label="Stake (% da banca base)"
                type="number"
                min="0.01"
                step="any"
                disabled={baseBankroll <= 0}
                value={stakePercent}
                onChange={(e) => {
                  setStakePercent(e.target.value);
                  setStake(
                    e.target.value === ""
                      ? ""
                      : String(
                          stakeFromPercent(
                            Number(e.target.value),
                            baseBankroll,
                          ),
                        ),
                  );
                }}
                placeholder="Ex.: 2"
              />
              <small className="muted">
                Base: {money(baseBankroll)} · banca inicial + aportes
              </small>
            </label>
            <label>
              Odd decimal
              <input
                type="number"
                min="1"
                step="0.001"
                required
                value={odds}
                onChange={(e) => setOdds(e.target.value)}
                placeholder="1,90"
              />
            </label>
            <label>
              Data e hora do evento
              <input
                name="event_at"
                type="datetime-local"
                required
                defaultValue={new Date(
                  (entry ? new Date(entry.event_at).getTime() : Date.now()) -
                    new Date().getTimezoneOffset() * 60000,
                )
                  .toISOString()
                  .slice(0, 16)}
              />
            </label>
            <label>
              Casa de apostas
              <input
                defaultValue={entry?.bookmaker}
                name="bookmaker"
                maxLength={100}
                placeholder="Opcional"
              />
            </label>
            <label className="full">
              Observações
              <textarea
                defaultValue={entry?.notes}
                name="notes"
                maxLength={2000}
                placeholder="Sua análise ou detalhes da entrada"
              />
            </label>
          </div>
          <div className="return-box">
            <span>
              Retorno total previsto
              <strong>{money(Number(stake) * Number(odds))}</strong>
            </span>
            <span>
              Lucro previsto
              <strong className="positive">
                {money(Number(stake) * (Math.max(1, Number(odds)) - 1))}
              </strong>
            </span>
          </div>
          <p className="muted">
            {entry ? (
              "O saldo será ajustado automaticamente conforme o valor, a odd e o resultado atual da entrada."
            ) : (
              <>
                Disponível: {money(balance)}. O valor será debitado ao
                registrar.
              </>
            )}
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <footer>
            <button type="button" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="primary"
              disabled={busy || (!entry && balance <= 0)}
            >
              <Check size={17} />
              {busy
                ? "Salvando…"
                : entry
                  ? "Salvar alterações"
                  : "Registrar entrada"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
