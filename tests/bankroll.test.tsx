import { expect, it } from "vitest";
import { bankrollBase, percentOfBase, stakeFromPercent } from "../src/bankroll";
it("uses initial bankroll and deposits, independent of profits and available balance", () => {
  const base = bankrollBase([
    { kind: "deposit", amount: 100 },
    { kind: "deposit", amount: 2 },
    { kind: "place", amount: -10 },
    { kind: "settle", amount: 58 },
    { kind: "withdraw", amount: -5 },
  ]);
  expect(base).toBe(102);
  expect(percentOfBase(48, base)).toBeCloseTo(47.0588235);
  expect(stakeFromPercent(2, base)).toBe(2.04);
  expect(percentOfBase(2.04, base)).toBeCloseTo(2);
});
it("does not divide by zero before bankroll registration", () => {
  expect(percentOfBase(10, 0)).toBeNull();
  expect(bankrollBase([])).toBe(0);
});
