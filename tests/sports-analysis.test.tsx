import { describe, it, expect } from "vitest";
import {
  normalizeMatch,
  normalizeStats,
  sample,
  summarize,
  saoPauloDate,
} from "../src/sports/analysis";
import {
  buildQuery,
  statisticIds,
  cacheKey,
} from "../supabase/functions/bet-sports/request";
import type { Match } from "../src/sports/types";
const match = (
  id: number,
  day: string,
  home = 1,
  away = 2,
  leagueId = 10,
): Match => ({
  id,
  kickoff: day + "T18:00:00Z",
  leagueId,
  league: "Liga",
  country: "Brasil",
  season: 2026,
  round: null,
  venue: null,
  home: { id: home, name: "A" },
  away: { id: away, name: "B" },
  status: "FT",
  elapsed: null,
  homeGoals: 2,
  awayGoals: 1,
  halftimeHome: 1,
  halftimeAway: 0,
});
describe("Sports samples", () => {
  it("uses regulation score for matches with extra time and excludes missing regulation data", () => {
    const extra = {
      ...match(50, "2026-10-01"),
      status: "AET",
      homeGoals: 3,
      awayGoals: 2,
      regulationHome: 1,
      regulationAway: 1,
    };
    const games = sample(
      [extra, { ...extra, id: 51, regulationHome: null }],
      1,
      {
        size: 10,
        venue: "all",
        leagueId: null,
        before: "2026-10-06T20:00:00Z",
      },
    );
    expect(games).toHaveLength(1);
    const s = summarize(games, 1, {});
    expect(s.draws).toBe(1);
    expect(s.over(2.5)).toBe(0);
  });
  it("filters venue and competition before taking the sample, excluding future/unfinished results", () => {
    const games = [
      match(1, "2026-10-06"),
      match(2, "2026-10-05", 2, 1),
      match(3, "2026-10-04", 1, 3),
      match(4, "2026-10-03", 1, 2, 20),
      match(5, "2026-10-02"),
      { ...match(6, "2026-10-01"), status: "NS" },
      match(7, "2026-09-30"),
    ];
    expect(
      sample(games, 1, {
        size: 2,
        venue: "home",
        leagueId: 10,
        before: "2026-10-06T18:00:00Z",
      }).map((m) => m.id),
    ).toEqual([3, 5]);
  });
  it("uses team perspective and distinguishes missing statistics from zero", () => {
    const games = [
      match(1, "2026-10-01"),
      match(2, "2026-09-30", 2, 1),
      { ...match(3, "2026-09-29"), homeGoals: 0, awayGoals: 0 },
    ];
    const stats = {
      1: [
        {
          teamId: 1,
          corners: 0,
          shots: null,
          onTarget: 0,
          possession: null,
          yellow: null,
          red: null,
        },
        {
          teamId: 2,
          corners: 4,
          shots: 5,
          onTarget: 2,
          possession: null,
          yellow: null,
          red: null,
        },
      ],
    };
    const r = summarize(games, 1, stats);
    expect([r.wins, r.draws, r.losses]).toEqual([1, 1, 1]);
    expect(r.scored).toBe(1);
    expect(r.corners).toBe(0);
    expect(r.cornerCount).toBe(1);
    expect(r.shots).toBeNull();
    expect(r.shotCount).toBe(0);
    expect(r.over(2.5)).toBeCloseTo(66.666, 2);
    expect(r.totalCornerCount).toBe(1);
    expect(r.cornersOver(3.5)).toBe(100);
    expect(summarize([], 1, {}).btts).toBeNull();
  });
  it("normalizes absent provider stats without inventing zeros", () => {
    expect(
      normalizeStats([
        {
          team: { id: 1 },
          statistics: [
            { type: "Corner Kicks", value: 0 },
            { type: "Total Shots", value: null },
            { type: "Ball Possession", value: "51%" },
          ],
        },
      ])[0],
    ).toMatchObject({ corners: 0, shots: null, possession: 51 });
    expect(normalizeMatch(null)).toBeNull();
    expect(normalizeMatch({ fixture: { id: 1, date: "bad" } })).toBeNull();
  });
  it("uses Brasília date around UTC midnight", () => {
    expect(saoPauloDate(new Date("2026-10-07T01:00:00Z"))).toBe("2026-10-06");
  });
});
describe("Provider proxy validation", () => {
  it("only allows named endpoints and validated dates/IDs", () => {
    expect(() =>
      buildQuery({ action: "fixtures", date: "2026-02-30" }),
    ).toThrow();
    expect(() => buildQuery({ action: "https://attacker.test" })).toThrow();
    expect(() =>
      buildQuery({ action: "history", team: "1&url=bad" }),
    ).toThrow();
    expect(
      buildQuery({ action: "fixtures", date: "2026-10-06" }).params.timezone,
    ).toBe("America/Sao_Paulo");
    expect(buildQuery({ action: "history", team: 1 }).params.last).toBe("100");
    expect(() =>
      statisticIds({ fixtures: Array.from({ length: 11 }, (_, i) => i + 1) }),
    ).toThrow();
    expect(statisticIds({ fixtures: [1, 1, 2] })).toEqual([1, 2]);
  });
  it("sorts cache query parameters for deduplication and bounds pagination", () => {
    expect(
      cacheKey({
        path: "odds",
        params: { page: "2", fixture: "123" },
        ttl: 10,
      }),
    ).toBe("odds?fixture=123&page=2");
    expect(() =>
      buildQuery({ action: "odds", fixture: 1, page: 51 }),
    ).toThrow();
  });
});
