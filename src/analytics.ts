import type { Competition, Entry } from "./lib";
export type Dimension =
  "market" | "selection" | "league" | "team" | "odds" | "bookmaker" | "period";
export const dimensions: Record<Dimension, string> = {
  market: "Mercados",
  selection: "Mercado e seleção",
  league: "Ligas",
  team: "Times e seleções",
  odds: "Faixas de odds",
  bookmaker: "Casas de apostas",
  period: "Períodos do jogo",
};
export const oddsBands = [1, 1.5, 1.75, 2, 2.5, 3, 4, 5, 10];
export function oddsBand(odds: number) {
  const start = [...oddsBands].reverse().find((n) => odds >= n) ?? 1;
  const end = oddsBands[oddsBands.indexOf(start) + 1];
  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  return {
    key: String(start),
    label: end ? `${fmt(start)} ≤ odd < ${fmt(end)}` : `Odd ≥ ${fmt(start)}`,
  };
}
export const marketFamily = (e: Entry) =>
  e.market.split(" · ")[0].trim() || "Sem mercado";
export const gamePeriod = (e: Entry) =>
  ["Jogo inteiro", "1º tempo", "2º tempo"].find((p) =>
    e.market.split(" · ").includes(p),
  ) ?? "Não informado / outro";
export const netProfit = (e: Entry) =>
  e.status === "won"
    ? Math.round(Number(e.stake) * Number(e.odds) * 100) / 100 - Number(e.stake)
    : e.status === "lost"
      ? -Number(e.stake)
      : 0;
export type Metrics = {
  total: number;
  settled: number;
  won: number;
  lost: number;
  refunded: number;
  pending: number;
  volume: number;
  exposure: number;
  gains: number;
  losses: number;
  net: number;
  returns: number;
  roi: number | null;
  accuracy: number | null;
  averageOdds: number | null;
  averageStake: number | null;
  maxStake: number;
  best: number | null;
  worst: number | null;
  maxDrawdown: number;
};
const cents = (n: number) => Math.round(n * 100) / 100;
export function metrics(entries: Entry[]): Metrics {
  const settled = entries.filter(
    (e) => e.status === "won" || e.status === "lost",
  );
  const won = settled.filter((e) => e.status === "won");
  const lost = settled.filter((e) => e.status === "lost");
  const volume = cents(settled.reduce((s, e) => s + Number(e.stake), 0));
  const gains = cents(won.reduce((s, e) => s + netProfit(e), 0));
  const losses = cents(lost.reduce((s, e) => s + Number(e.stake), 0));
  const pending = entries.filter((e) => e.status === "pending");
  const profits = settled.map(netProfit);
  let accumulated = 0,
    peak = 0,
    maxDrawdown = 0;
  for (const e of [...settled].sort(
    (a, b) =>
      new Date(a.settled_at ?? a.created_at).getTime() -
      new Date(b.settled_at ?? b.created_at).getTime(),
  )) {
    accumulated = cents(accumulated + netProfit(e));
    peak = Math.max(peak, accumulated);
    maxDrawdown = Math.max(maxDrawdown, peak - accumulated);
  }
  return {
    total: entries.length,
    settled: settled.length,
    won: won.length,
    lost: lost.length,
    refunded: entries.filter((e) => e.status === "refunded").length,
    pending: pending.length,
    volume,
    exposure: cents(pending.reduce((s, e) => s + Number(e.stake), 0)),
    gains,
    losses,
    net: cents(gains - losses),
    returns: cents(won.reduce((s, e) => s + Number(e.stake) + netProfit(e), 0)),
    roi: volume ? ((gains - losses) / volume) * 100 : null,
    accuracy: settled.length ? (won.length / settled.length) * 100 : null,
    averageOdds: settled.length
      ? settled.reduce((s, e) => s + Number(e.odds), 0) / settled.length
      : null,
    averageStake: settled.length ? volume / settled.length : null,
    maxStake: entries.reduce((s, e) => Math.max(s, Number(e.stake)), 0),
    best: profits.length
      ? profits.reduce((a, b) => Math.max(a, b), -Infinity)
      : null,
    worst: profits.length
      ? profits.reduce((a, b) => Math.min(a, b), Infinity)
      : null,
    maxDrawdown: cents(maxDrawdown),
  };
}
export type Group = Metrics & { key: string; label: string; entries: Entry[] };
export function groupEntries(
  entries: Entry[],
  dimension: Dimension,
  catalog: Competition[],
): Group[] {
  const competitions = new Map(catalog.map((c) => [c.id, c]));
  const groups = new Map<string, { label: string; entries: Entry[] }>();
  for (const e of entries) {
    let values: [string, string][];
    switch (dimension) {
      case "market":
        values = [[marketFamily(e), marketFamily(e)]];
        break;
      case "selection":
        values = [[e.market, e.market]];
        break;
      case "league":
        values = [
          [
            e.catalog_id,
            competitions.get(e.catalog_id)?.name ?? "Competição não encontrada",
          ],
        ];
        break;
      case "team":
        values = [...new Set([e.home, e.away])].map((team) => [team, team]);
        break;
      case "odds": {
        const b = oddsBand(Number(e.odds));
        values = [[b.key, b.label]];
        break;
      }
      case "bookmaker": {
        const name = e.bookmaker.trim() || "Não informada";
        values = [[name.toLocaleLowerCase("pt-BR"), name]];
        break;
      }
      case "period":
        values = [[gamePeriod(e), gamePeriod(e)]];
        break;
    }
    for (const [key, label] of values) {
      if (!groups.has(key)) groups.set(key, { label, entries: [] });
      groups.get(key)!.entries.push(e);
    }
  }
  return [...groups].map(([key, g]) => ({
    key,
    label: g.label,
    entries: g.entries,
    ...metrics(g.entries),
  }));
}
export const normalizeSearch = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
