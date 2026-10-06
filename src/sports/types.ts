export type Team = { id: number; name: string; logo?: string };
export type Match = {
  id: number;
  kickoff: string;
  leagueId: number;
  league: string;
  country: string;
  season: number;
  round: string | null;
  venue: string | null;
  home: Team;
  away: Team;
  status: string;
  elapsed: number | null;
  homeGoals: number | null;
  awayGoals: number | null;
  regulationHome?: number | null;
  regulationAway?: number | null;
  halftimeHome: number | null;
  halftimeAway: number | null;
};
export type TeamStats = {
  teamId: number;
  corners: number | null;
  shots: number | null;
  onTarget: number | null;
  possession: number | null;
  yellow: number | null;
  red: number | null;
};
export type MatchStats = Record<number, TeamStats[]>;
export type SportsResponse = {
  response: unknown[];
  fetchedAt: string | null;
  cached: boolean;
  stale: boolean;
  remaining: number | null;
  paging?: { current: number; total: number };
  warning?: string;
};
export type VenueFilter = "all" | "home" | "away";
export type SampleFilter = {
  size: number;
  venue: VenueFilter;
  leagueId: number | null;
  before: string;
};
export type WatchMatch = {
  favorite?: boolean;
  match: Match;
  note: string;
  savedAt: string;
};
export type OddsRow = {
  bookmaker: string;
  market: string;
  selection: string;
  odd: number;
  updated: string | null;
};
