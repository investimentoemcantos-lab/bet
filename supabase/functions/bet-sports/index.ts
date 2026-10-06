import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import {
  buildQuery,
  cacheKey,
  statisticIds,
  type ProviderQuery,
} from "./request.ts";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
class ProviderError extends Error {
  constructor(
    message: string,
    public status = 503,
  ) {
    super(message);
  }
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")
    return json({ message: "Método não permitido." }, 405);
  if (Number(req.headers.get("content-length") || 0) > 8192)
    return json({ message: "Consulta muito grande." }, 413);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token || token === authHeader)
      return json(
        { message: "Entre na sua conta para consultar os jogos." },
        401,
      );
    const client = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser(token);
    if (authError || !user)
      return json({ message: "Sessão inválida. Entre novamente." }, 401);
    const admin = createClient(
      url,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data: wallet, error: walletError } = await admin
      .from("bet_wallets")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (walletError) throw new Error("Banco indisponível");
    if (!wallet)
      return json(
        { message: "Configure sua banca para ativar seu painel de trabalho." },
        403,
      );
    const raw = await req.text();
    if (raw.length > 8192)
      return json({ message: "Consulta muito grande." }, 413);
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw);
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new Error();
    } catch {
      return json({ message: "Consulta inválida." }, 400);
    }
    const key = Deno.env.get("API_FOOTBALL_KEY");
    const requestedBudget = Number(Deno.env.get("SPORTS_DAILY_BUDGET") || 80);
    const budget =
      Number.isInteger(requestedBudget) &&
      requestedBudget >= 1 &&
      requestedBudget <= 7500
        ? requestedBudget
        : 80;
    const day = new Date().toISOString().slice(0, 10);
    if (body.action === "status") {
      const { data, error } = await admin
        .from("bet_sports_usage")
        .select("calls")
        .eq("usage_day", day)
        .maybeSingle();
      if (error) throw error;
      return json({
        response: [
          {
            configured: !!key,
            budget,
            remaining: Math.max(0, budget - (data?.calls || 0)),
          },
        ],
        cached: false,
        stale: false,
        fetchedAt: null,
        remaining: Math.max(0, budget - (data?.calls || 0)),
      });
    }
    let queries: ProviderQuery[],
      ids: number[] = [];
    try {
      if (body.action === "statistics") {
        ids = statisticIds(body);
        queries = ids.map((id) => ({
          path: "fixtures/statistics",
          params: { fixture: String(id) },
          ttl: 300,
        }));
      } else queries = [buildQuery(body)];
    } catch {
      return json(
        { message: "Data, partida ou tipo de consulta inválido." },
        400,
      );
    }
    if (!key)
      return json(
        {
          message:
            "A fonte de dados esportivos ainda não foi ativada. A central está preparada para receber jogos e estatísticas reais.",
        },
        503,
      );
    async function query(q: ProviderQuery) {
      const cache = cacheKey(q),
        lease = crypto.randomUUID();
      const { data: claim, error } = await admin.rpc("bet_sports_claim", {
        p_key: cache,
        p_budget: budget,
        p_token: lease,
      });
      if (error) throw error;
      const old = claim.payload as {
        response: unknown[];
        paging?: { current: number; total: number };
      } | null;
      const stale = (warning: string) => ({
        response: old!.response,
        paging: old!.paging,
        fetchedAt: claim.fetchedAt,
        cached: true,
        stale: true,
        remaining: claim.remaining,
        warning,
      });
      if (claim.state === "cached")
        return {
          response: old!.response,
          paging: old!.paging,
          fetchedAt: claim.fetchedAt,
          cached: true,
          stale: false,
          remaining: claim.remaining,
        };
      if (claim.state !== "claimed") {
        const message =
          claim.state === "limit"
            ? "O orçamento de consultas de hoje foi atingido."
            : claim.state === "minute_limit"
              ? "Limite de consultas por minuto atingido. Aguarde um minuto antes de consultar novamente."
              : "Esta consulta está sendo atualizada. Aguarde alguns instantes.";
        if (old) return stale(message + " Mostrando a última consulta salva.");
        throw new ProviderError(message, 429);
      }
      try {
        const result = await fetch(
          "https://v3.football.api-sports.io/" + cache,
          {
            headers: { "x-apisports-key": key! },
            signal: AbortSignal.timeout(15000),
          },
        );
        if (!result.ok)
          throw new ProviderError(
            result.status === 429
              ? "A cota do fornecedor foi atingida. Tente novamente mais tarde."
              : "O fornecedor não respondeu à consulta.",
            result.status === 429 ? 429 : 502,
          );
        const payload = await result.json();
        if (
          !Array.isArray(payload.response) ||
          Object.keys(payload.errors || {}).length
        )
          throw new ProviderError(
            "A fonte não autorizou esta consulta. Verifique a chave, o plano e a temporada disponível.",
            502,
          );
        const fetchedAt = new Date().toISOString();
        const write = await admin
          .from("bet_sports_cache")
          .update({
            payload: { response: payload.response, paging: payload.paging },
            fetched_at: fetchedAt,
            expires_at: new Date(Date.now() + q.ttl * 1000).toISOString(),
            lock_until: null,
            lock_token: null,
          })
          .eq("cache_key", cache)
          .eq("lock_token", lease);
        if (write.error) throw write.error;
        return {
          response: payload.response as unknown[],
          paging: payload.paging,
          fetchedAt,
          cached: false,
          stale: false,
          remaining: claim.remaining,
        };
      } catch (e) {
        await admin
          .from("bet_sports_cache")
          .update({ lock_until: new Date(Date.now() + 30000).toISOString() })
          .eq("cache_key", cache)
          .eq("lock_token", lease);
        if (old)
          return stale(
            "A atualização falhou. Mostrando a última consulta salva.",
          );
        throw e;
      }
    }
    if (body.action !== "statistics") return json(await query(queries[0]));
    const rows: unknown[] = [];
    let remaining: number | null = null;
    const warnings: string[] = [];
    let fetchedAt: string | null = null;
    for (let i = 0; i < queries.length; i++) {
      try {
        const r = await query(queries[i]);
        rows.push({
          fixture: ids[i],
          response: r.response,
          fetchedAt: r.fetchedAt,
          stale: r.stale,
        });
        remaining = r.remaining;
        fetchedAt = r.fetchedAt;
        if (r.warning) warnings.push(r.warning);
      } catch (e) {
        warnings.push(
          e instanceof ProviderError
            ? e.message
            : "Não foi possível carregar todas as estatísticas.",
        );
        break;
      }
    }
    if (!rows.length)
      throw new ProviderError(
        warnings[0] || "Sem estatísticas disponíveis.",
        429,
      );
    return json({
      response: rows,
      cached: false,
      stale: false,
      fetchedAt,
      remaining,
      warning: warnings.length ? [...new Set(warnings)].join(" ") : undefined,
    });
  } catch (e) {
    return json(
      {
        message:
          e instanceof ProviderError
            ? e.message
            : "Não foi possível consultar a fonte de dados agora.",
      },
      e instanceof ProviderError ? e.status : 503,
    );
  }
});
