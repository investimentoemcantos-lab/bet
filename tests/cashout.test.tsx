import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import CashoutFields from "../src/CashoutFields";
import { netProfit, validCashout } from "../src/settlement";
import { metrics } from "../src/analytics";
import type { Entry } from "../src/lib";
vi.mock("../src/lib", () => ({ money: (n: number) => `R$ ${n.toFixed(2)}` }));
afterEach(cleanup);
const entry: Entry = {
  id: "test",
  catalog_id: "test",
  home: "A",
  away: "B",
  market: "Gols",
  stake: 10,
  odds: 2,
  status: "cashed_out",
  bookmaker: "",
  notes: "",
  created_at: "2026-10-04T12:00:00Z",
  event_at: "2026-10-04T14:00:00Z",
  settled_at: "2026-10-04T15:00:00Z",
};
it("calculates loss, profit, break-even and total loss from the actual cashout", () => {
  for (const [amount, net] of [
    [7, -3],
    [15, 5],
    [10, 0],
    [0, -10],
  ])
    expect(netProfit({ ...entry, cashout_amount: amount })).toBe(net);
  for (const value of ["", "-1", "Infinity", "NaN", "1.001"])
    expect(validCashout(value)).toBe(false);
  expect(validCashout("0")).toBe(true);
});
it("includes cashouts in net profit and ROI, excludes break-even from accuracy", () => {
  const m = metrics(
    [7, 15, 10].map((amount, i) => ({
      ...entry,
      id: String(i),
      cashout_amount: amount,
    })),
  );
  expect(m).toMatchObject({
    settled: 3,
    cashedOut: 3,
    won: 1,
    lost: 1,
    gains: 5,
    losses: 3,
    net: 2,
    volume: 30,
    returns: 32,
    accuracy: 50,
  });
  expect(m.roi).toBeCloseTo(6.666666);
});
it("shows the amount credited and its net result while editing", async () => {
  function Fixture() {
    const [v, setV] = useState("");
    return <CashoutFields stake={10} value={v} onChange={setV} />;
  }
  const user = userEvent.setup();
  render(<Fixture />);
  const input = screen.getByLabelText("Valor recebido no encerramento (R$)");
  await user.type(input, "7");
  expect(screen.getByText("R$ -3.00")).toBeTruthy();
  await user.clear(input);
  await user.type(input, "15");
  expect(screen.getByText("R$ 5.00")).toBeTruthy();
});
