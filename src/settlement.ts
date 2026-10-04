import type { Entry } from "./lib";
export const isSettled = (e: Entry) =>
  ["won", "lost", "cashed_out"].includes(e.status);
export const netProfit = (e: Entry) =>
  Math.round(
    (e.status === "cashed_out"
      ? Number(e.cashout_amount ?? 0) - Number(e.stake)
      : e.status === "won"
        ? Math.round(Number(e.stake) * Number(e.odds) * 100) / 100 -
          Number(e.stake)
        : e.status === "lost"
          ? -Number(e.stake)
          : 0) * 100,
  ) / 100;
export const isWin = (e: Entry) =>
  e.status === "won" || (e.status === "cashed_out" && netProfit(e) > 0);
export const isLoss = (e: Entry) =>
  e.status === "lost" || (e.status === "cashed_out" && netProfit(e) < 0);
export const validCashout = (value: string) =>
  value.trim() !== "" &&
  Number.isFinite(Number(value)) &&
  Number(value) >= 0 &&
  Math.abs(Number(value) * 100 - Math.round(Number(value) * 100)) < 0.00001;
