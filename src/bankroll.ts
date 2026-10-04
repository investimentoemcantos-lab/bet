import type { Ledger } from "./lib";
// Capital registered by the user, independent of betting returns and withdrawals.
export const bankrollBase = (ledger: Pick<Ledger, "kind" | "amount">[]) =>
  Math.round(
    ledger
      .filter((l) => l.kind === "deposit")
      .reduce((total, l) => total + Number(l.amount), 0) * 100,
  ) / 100;
export const percentOfBase = (amount: number, base: number): number | null =>
  base > 0 ? (amount / base) * 100 : null;
export const stakeFromPercent = (percent: number, base: number) =>
  Math.round(base * percent) / 100;
