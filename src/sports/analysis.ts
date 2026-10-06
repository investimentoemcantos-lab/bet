import type { Match, MatchStats, SampleFilter, TeamStats } from "./types";
export const finished = (m: Match) => ["FT", "AET", "PEN"].includes(m.status);
export const normalizeSearch = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function regulationScore(m: Match): [number | null, number | null] {
  return m.status === "AET" || m.status === "PEN"
    ? [m.regulationHome ?? null, m.regulationAway ?? null]
    : [m.homeGoals, m.awayGoals];
}
export function sample(matches: Match[], team: number, f: SampleFilter) {
  return matches
    .filter(
      (m) =>
        finished(m) &&
        regulationScore(m).every((n) => n !== null) &&
        (m.home.id === team || m.away.id === team) &&
        new Date(m.kickoff) < new Date(f.before) &&
        (f.leagueId === null || m.leagueId === f.leagueId) &&
        (f.venue === "all" ||
          (f.venue === "home" ? m.home.id === team : m.away.id === team)),
    )
    .sort((a, b) => Date.parse(b.kickoff) - Date.parse(a.kickoff))
    .slice(0, f.size);
}
export function summarize(matches: Match[], team: number, stats: MatchStats) {
  let wins = 0,
    draws = 0,
    losses = 0;
  const scored: number[] = [],
    conceded: number[] = [],
    corners: number[] = [],
    cornersAgainst: number[] = [],
    totalCorners: number[] = [],
    shots: number[] = [],
    onTarget: number[] = [];
  for (const m of matches) {
    const home = m.home.id === team;
    const [homeGoals, awayGoals] = regulationScore(m);
    const a = (home ? homeGoals : awayGoals)!;
    const b = (home ? awayGoals : homeGoals)!;
    scored.push(a);
    conceded.push(b);
    if (a > b) wins++;
    else if (a === b) draws++;
    else losses++;
    const own = stats[m.id]?.find((s) => s.teamId === team);
    const opponent = stats[m.id]?.find(
      (s) => s.teamId === (home ? m.away.id : m.home.id),
    );
    if (own?.corners != null) corners.push(own.corners);
    if (opponent?.corners != null) cornersAgainst.push(opponent.corners);
    if (own?.corners != null && opponent?.corners != null)
      totalCorners.push(own.corners + opponent.corners);
    if (own?.shots != null) shots.push(own.shots);
    if (own?.onTarget != null) onTarget.push(own.onTarget);
  }
  const average = (a: number[]) =>
    a.length ? a.reduce((s, n) => s + n, 0) / a.length : null;
  const frequency = (predicate: (i: number) => boolean) =>
    matches.length
      ? (scored.filter((_, i) => predicate(i)).length / matches.length) * 100
      : null;
  return {
    count: matches.length,
    wins,
    draws,
    losses,
    scored: average(scored),
    conceded: average(conceded),
    btts: frequency((i) => scored[i] > 0 && conceded[i] > 0),
    cleanSheets: frequency((i) => conceded[i] === 0),
    over: (line: number) => frequency((i) => scored[i] + conceded[i] > line),
    corners: average(corners),
    cornersAgainst: average(cornersAgainst),
    cornerCount: corners.length,
    totalCornerCount: totalCorners.length,
    cornersOver: (line: number) =>
      totalCorners.length
        ? (totalCorners.filter((n) => n > line).length / totalCorners.length) *
          100
        : null,
    shots: average(shots),
    shotCount: shots.length,
    onTarget: average(onTarget),
    onTargetCount: onTarget.length,
  };
}
export function statNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n =
    typeof value === "number" ? value : Number(String(value).replace("%", ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function normalizeMatch(input: unknown): Match | null {
  const r = input as {
    fixture?: {
      id?: number;
      date?: string;
      status?: { short?: string; elapsed?: number };
      venue?: { name?: string };
    };
    league?: {
      id?: number;
      name?: string;
      country?: string;
      season?: number;
      round?: string;
    };
    teams?: {
      home?: { id?: number; name?: string; logo?: string };
      away?: { id?: number; name?: string; logo?: string };
    };
    goals?: { home?: number; away?: number };
    score?: {
      halftime?: { home?: number; away?: number };
      fulltime?: { home?: number; away?: number };
    };
  };
  if (
    !r?.fixture?.id ||
    !r.fixture.date ||
    !Number.isFinite(Date.parse(r.fixture.date)) ||
    !r.teams?.home?.id ||
    !r.teams.away?.id ||
    !r.league?.id
  )
    return null;
  return {
    id: r.fixture.id,
    kickoff: r.fixture.date,
    leagueId: r.league.id,
    league: r.league.name || "Competição",
    country: r.league.country || "",
    season: r.league.season || 0,
    round: r.league.round || null,
    venue: r.fixture.venue?.name || null,
    home: {
      id: r.teams.home.id,
      name: r.teams.home.name || "Mandante",
      logo: r.teams.home.logo,
    },
    away: {
      id: r.teams.away.id,
      name: r.teams.away.name || "Visitante",
      logo: r.teams.away.logo,
    },
    status: r.fixture.status?.short || "NS",
    elapsed: r.fixture.status?.elapsed ?? null,
    homeGoals: statNumber(r.goals?.home),
    awayGoals: statNumber(r.goals?.away),
    regulationHome: statNumber(r.score?.fulltime?.home),
    regulationAway: statNumber(r.score?.fulltime?.away),
    halftimeHome: statNumber(r.score?.halftime?.home),
    halftimeAway: statNumber(r.score?.halftime?.away),
  };
}
export function normalizeStats(rows: unknown[]): TeamStats[] {
  return rows.flatMap((input) => {
    const r = input as {
      team?: { id?: number };
      statistics?: { type: string; value: unknown }[];
    };
    if (!r?.team?.id || !Array.isArray(r.statistics)) return [];
    const get = (type: string) =>
      statNumber(r.statistics!.find((s) => s.type === type)?.value);
    return [
      {
        teamId: r.team.id,
        corners: get("Corner Kicks"),
        shots: get("Total Shots"),
        onTarget: get("Shots on Goal"),
        possession: get("Ball Possession"),
        yellow: get("Yellow Cards"),
        red: get("Red Cards"),
      },
    ];
  });
}
export const statusLabel = (m: Match) =>
  finished(m)
    ? "Encerrado"
    : ["1H", "HT", "2H", "ET", "BT", "P", "LIVE"].includes(m.status)
      ? m.status === "HT"
        ? "Intervalo"
        : `Ao vivo · ${m.elapsed ?? "—"}′`
      : {
          PST: "Adiado",
          CANC: "Cancelado",
          SUSP: "Suspenso",
          ABD: "Abandonado",
          TBD: "Horário a definir",
        }[m.status] || "Agendado";
export const live = (m: Match) =>
  ["1H", "HT", "2H", "ET", "BT", "P", "LIVE"].includes(m.status);
export const saoPauloDate = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
export const matchTime = (v: string) =>
  new Date(v).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
export const matchDate = (v: string) =>
  new Date(v).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
