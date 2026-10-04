import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
export type Entry = {
  id: string;
  catalog_id: string;
  home: string;
  away: string;
  market: string;
  stake: number;
  odds: number;
  status: string;
  bookmaker: string;
  notes: string;
  event_at: string;
  created_at: string;
  settled_at: string | null;
};
export type Ledger = {
  id: string;
  entry_id: string | null;
  amount: number;
  balance_after: number;
  kind: string;
  description: string;
  created_at: string;
};
export type Competition = {
  id: string;
  kind: string;
  country: string;
  name: string;
  teams: string[];
  source: string;
  updated_at: string;
};
export const money = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    v,
  );
export const date = (v: string) =>
  new Date(v).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
export const statusName: Record<string, string> = {
  pending: "Em aberto",
  won: "Ganha",
  lost: "Perdida",
  refunded: "Reembolsada",
};
export const profit = (e: Entry) =>
  e.status === "won"
    ? Math.round(Number(e.stake) * (Number(e.odds) - 1) * 100) / 100
    : e.status === "lost"
      ? -Number(e.stake)
      : 0;
export async function command(
  action: string,
  payload: Record<string, unknown>,
  request = crypto.randomUUID(),
) {
  const { error } = await supabase.rpc("bet_command", {
    action,
    payload,
    request,
  });
  if (error) throw error;
}
