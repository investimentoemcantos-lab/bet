export type MarketDefinition = {
  id: string;
  name: string;
  kind: "total" | "handicap" | "choice" | "exact" | "score" | "custom";
  max?: number;
  step?: number;
  choices?: [string, string][];
  scope?: boolean;
};
export const MARKETS: MarketDefinition[] = [
  { id: "goals", name: "Gols", kind: "total", max: 10, scope: true },
  { id: "corners", name: "Escanteios", kind: "total", max: 30, scope: true },
  {
    id: "corners_asian_handicap",
    name: "Escanteios — handicap asiático",
    kind: "handicap",
    max: 20,
    step: 0.25,
  },
  {
    id: "corners_result",
    name: "Escanteios — resultado (1X2)",
    kind: "choice",
    choices: [
      ["home", "Vitória da equipe 1 (1)"],
      ["draw", "Empate (X)"],
      ["away", "Vitória da equipe 2 (2)"],
    ],
  },
  { id: "cards", name: "Cartões", kind: "total", max: 15, scope: true },
  { id: "shots", name: "Finalizações", kind: "total", max: 50, scope: true },
  {
    id: "shots_target",
    name: "Finalizações no alvo",
    kind: "total",
    max: 25,
    scope: true,
  },
  { id: "offsides", name: "Impedimentos", kind: "total", max: 15, scope: true },
  { id: "fouls", name: "Faltas", kind: "total", max: 50, scope: true },
  {
    id: "asian_handicap",
    name: "Handicap asiático",
    kind: "handicap",
    max: 5,
    step: 0.25,
  },
  {
    id: "european_handicap",
    name: "Handicap europeu",
    kind: "handicap",
    max: 5,
    step: 1,
  },
  {
    id: "result",
    name: "Resultado (1X2)",
    kind: "choice",
    choices: [
      ["home", "Vitória da equipe 1"],
      ["draw", "Empate"],
      ["away", "Vitória da equipe 2"],
    ],
  },
  {
    id: "btts",
    name: "Ambas marcam",
    kind: "choice",
    choices: [
      ["yes", "Sim"],
      ["no", "Não"],
    ],
  },
  {
    id: "double_chance",
    name: "Dupla chance",
    kind: "choice",
    choices: [
      ["1x", "Equipe 1 ou empate (1X)"],
      ["x2", "Empate ou equipe 2 (X2)"],
      ["12", "Equipe 1 ou equipe 2 (12)"],
    ],
  },
  {
    id: "draw_no_bet",
    name: "Empate anula aposta",
    kind: "choice",
    choices: [
      ["home", "Equipe 1"],
      ["away", "Equipe 2"],
    ],
  },
  {
    id: "exact_goals",
    name: "Número exato de gols",
    kind: "exact",
    max: 12,
    step: 1,
    scope: true,
  },
  { id: "correct_score", name: "Placar exato", kind: "score" },
  {
    id: "odd_even",
    name: "Gols par / ímpar",
    kind: "choice",
    choices: [
      ["even", "Par"],
      ["odd", "Ímpar"],
    ],
    scope: true,
  },
  {
    id: "clean_sheet",
    name: "Equipe não sofre gol",
    kind: "choice",
    choices: [
      ["yes", "Sim"],
      ["no", "Não"],
    ],
    scope: true,
  },
  {
    id: "half_full",
    name: "Intervalo / final",
    kind: "choice",
    choices: [
      ["1/1", "Equipe 1 / equipe 1"],
      ["1/X", "Equipe 1 / empate"],
      ["1/2", "Equipe 1 / equipe 2"],
      ["X/1", "Empate / equipe 1"],
      ["X/X", "Empate / empate"],
      ["X/2", "Empate / equipe 2"],
      ["2/1", "Equipe 2 / equipe 1"],
      ["2/X", "Equipe 2 / empate"],
      ["2/2", "Equipe 2 / equipe 2"],
    ],
  },
  { id: "custom", name: "Outro mercado", kind: "custom" },
];
export const PERIODS: Record<string, string> = {
  full: "Jogo inteiro",
  first: "1º tempo",
  second: "2º tempo",
};
export type MarketValue = {
  type: string;
  period: string;
  scope: string;
  selection: string;
  line: string;
  customLine: string;
  homeScore: string;
  awayScore: string;
  description: string;
};
export const emptyMarket = (): MarketValue => ({
  type: "",
  period: "full",
  scope: "match",
  selection: "",
  line: "",
  customLine: "",
  homeScore: "",
  awayScore: "",
  description: "",
});
export const formatLine = (n: number, signed = false) =>
  (signed && n > 0 ? "+" : "") +
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(n);
export function marketLines(m: MarketDefinition) {
  const step = m.step ?? 0.25;
  const min =
    m.kind === "handicap" ? -(m.max ?? 5) : m.kind === "exact" ? 0 : 0.25;
  const max = m.max ?? 10;
  return Array.from(
    { length: Math.round((max - min) / step) + 1 },
    (_, i) => Math.round((min + i * step) * 100) / 100,
  );
}
export function marketChoiceLabel(
  m: MarketDefinition,
  choice: [string, string],
  home: string,
  away: string,
) {
  if (m.id === "corners_result" || m.id === "result") {
    if (choice[0] === "home")
      return home ? `Vitória de ${home} (1)` : choice[1];
    if (choice[0] === "away")
      return away ? `Vitória de ${away} (2)` : choice[1];
    return "Empate (X)";
  }
  return choice[1];
}
export function marketLabel(
  v: MarketValue,
  home: string,
  away: string,
): string {
  const m = MARKETS.find((m) => m.id === v.type);
  if (!m) return "";
  if (m.kind === "custom") return v.description.trim().slice(0, 200);
  const period = PERIODS[v.period];
  if (!period) return "";
  const team =
    v.scope === "home"
      ? home
      : v.scope === "away"
        ? away
        : v.scope === "match"
          ? "Total do jogo"
          : "";
  const scoped = m.scope;
  if (scoped && !team) return "";
  const parts = [m.name];
  if (scoped) parts.push(team);
  if (m.kind === "total" || m.kind === "handicap" || m.kind === "exact") {
    const raw = v.line === "custom" ? v.customLine : v.line;
    if (raw === "") return "";
    const line = Number(raw);
    const step = m.step ?? 0.25;
    if (
      !Number.isFinite(line) ||
      Math.abs(line / step - Math.round(line / step)) > 0.00001
    )
      return "";
    if ((m.kind === "total" && line <= 0) || (m.kind === "exact" && line < 0))
      return "";
    if (m.kind === "handicap") {
      if (v.selection === "draw" && m.id !== "european_handicap") return "";
      if (
        ![
          "home",
          "away",
          ...(m.id === "european_handicap" ? ["draw"] : []),
        ].includes(v.selection)
      )
        return "";
      // European handicap lines are always applied to equipe 1; Asian lines to the selected team.
      const pick =
        v.selection === "draw"
          ? "Empate"
          : v.selection === "home"
            ? home
            : away;
      if (!pick) return "";
      parts.push(
        m.id === "european_handicap"
          ? `Equipe 1 ${formatLine(line, true)} · ${pick}`
          : `${pick} ${formatLine(line, true)}`,
      );
    } else if (m.kind === "total") {
      if (!["over", "under"].includes(v.selection)) return "";
      parts.push(
        `${v.selection === "over" ? "Mais de" : "Menos de"} ${formatLine(line)}`,
      );
    } else parts.push(formatLine(line));
  } else if (m.kind === "score") {
    if (v.homeScore === "" || v.awayScore === "") return "";
    const scores = [Number(v.homeScore), Number(v.awayScore)];
    if (scores.some((n) => !Number.isInteger(n) || n < 0 || n > 30)) return "";
    parts.push(`${scores[0]} × ${scores[1]}`);
  } else {
    const choice = m.choices?.find((c) => c[0] === v.selection);
    if (!choice) return "";
    if (
      ["result", "corners_result"].includes(m.id) &&
      ((v.selection === "home" && !home) || (v.selection === "away" && !away))
    )
      return "";
    parts.push(marketChoiceLabel(m, choice, home, away));
  }
  if (v.type !== "half_full") parts.push(period);
  const label = parts.join(" · ");
  return label.length <= 200 ? label : "";
}
