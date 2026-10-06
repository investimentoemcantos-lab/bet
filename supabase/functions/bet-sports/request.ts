export type ProviderQuery = {
  path: string;
  params: Record<string, string>;
  ttl: number;
};
export function positiveId(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0)
    throw new Error("Identificador inválido.");
  return value;
}
export function buildQuery(body: Record<string, unknown>): ProviderQuery {
  const timezone = "America/Sao_Paulo";
  switch (body.action) {
    case "fixtures": {
      if (
        typeof body.date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(body.date) ||
        new Date(body.date + "T12:00:00Z").toISOString().slice(0, 10) !==
          body.date
      )
        throw new Error("Data inválida.");
      return {
        path: "fixtures",
        params: { date: body.date, timezone },
        ttl: 300,
      };
    }
    case "history":
      return {
        path: "fixtures",
        params: { team: String(positiveId(body.team)), last: "100", timezone },
        ttl: 21600,
      };
    case "fixture":
      return {
        path: "fixtures",
        params: { id: String(positiveId(body.fixture)), timezone },
        ttl: 60,
      };
    case "h2h":
      return {
        path: "fixtures/headtohead",
        params: {
          h2h: `${positiveId(body.home)}-${positiveId(body.away)}`,
          last: "50",
          timezone,
        },
        ttl: 21600,
      };
    case "odds": {
      const page = body.page === undefined ? 1 : positiveId(body.page);
      if (page > 50) throw new Error("Página inválida.");
      return {
        path: "odds",
        params: {
          fixture: String(positiveId(body.fixture)),
          page: String(page),
        },
        ttl: 900,
      };
    }
    default:
      throw new Error("Consulta inválida.");
  }
}
export function statisticIds(body: Record<string, unknown>): number[] {
  if (
    !Array.isArray(body.fixtures) ||
    body.fixtures.length < 1 ||
    body.fixtures.length > 10
  )
    throw new Error("Consulte entre 1 e 10 partidas por vez.");
  return [...new Set(body.fixtures.map(positiveId))];
}
export function cacheKey(q: ProviderQuery) {
  return (
    q.path +
    "?" +
    new URLSearchParams(
      Object.entries(q.params).sort(([a], [b]) => a.localeCompare(b)),
    ).toString()
  );
}
