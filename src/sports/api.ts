import { supabase } from "../lib";
import { normalizeMatch } from "./analysis";
import type { Match, OddsRow, SportsResponse } from "./types";
export async function sportsRequest(
  action: string,
  params: Record<string, unknown> = {},
): Promise<SportsResponse> {
  const { data, error } = await supabase.functions.invoke("bet-sports", {
    body: { action, ...params },
  });
  if (error) {
    let detail: { message?: string } = {};
    try {
      detail = await error.context?.json();
    } catch {}
    throw new Error(
      detail?.message ||
        "Não foi possível consultar os jogos. Tente novamente em instantes.",
    );
  }
  if (data?.message) throw new Error(data.message);
  if (!Array.isArray(data?.response))
    throw new Error("Resposta inválida da integração esportiva.");
  return data as SportsResponse;
}
export const asMatches = (r: SportsResponse): Match[] =>
  r.response.map(normalizeMatch).filter((m): m is Match => m !== null);
export function asOdds(r: SportsResponse): OddsRow[] {
  return r.response.flatMap((input) => {
    const item = input as {
      update?: string;
      bookmakers?: {
        name: string;
        bets?: { name: string; values?: { value: string; odd: string }[] }[];
      }[];
    };
    return (item?.bookmakers || []).flatMap((b) =>
      (b.bets || []).flatMap((m) =>
        (m.values || []).flatMap((v) =>
          Number.isFinite(Number(v.odd)) && Number(v.odd) >= 1
            ? [
                {
                  bookmaker: b.name,
                  market: m.name,
                  selection: v.value,
                  odd: Number(v.odd),
                  updated: item.update || null,
                },
              ]
            : [],
        ),
      ),
    );
  });
}
