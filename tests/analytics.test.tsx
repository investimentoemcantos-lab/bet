import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { metrics, groupEntries, oddsBand } from "../src/analytics";
import AnalyticsPage from "../src/AnalyticsPage";
import type { Entry, Competition } from "../src/lib";
import { selectOption } from "./selectOption";
vi.mock("../src/lib", () => ({
  money: (n: number) => `R$ ${n.toFixed(2)}`,
  date: (s: string) => s,
  statusName: {
    won: "Ganha",
    lost: "Perdida",
    pending: "Em aberto",
    refunded: "Reembolsada",
  },
}));
afterEach(cleanup);
const catalog: Competition[] = [
  {
    id: "league",
    name: "Liga A",
    kind: "clubs",
    country: "Brasil",
    teams: ["A", "B"],
    source: "",
    updated_at: "2026-10-04",
  },
];
const make = (
  id: string,
  status: string,
  stake: number,
  odds: number,
  market = "Gols · Total do jogo · Mais de 2,5 · Jogo inteiro",
): Entry => ({
  id,
  catalog_id: "league",
  home: "A",
  away: "B",
  market,
  stake,
  odds,
  status,
  bookmaker: "Casa",
  notes: "",
  created_at: "2026-10-04T12:00:00Z",
  event_at: "2026-10-04T14:00:00Z",
  settled_at:
    status === "pending"
      ? null
      : `2026-10-04T${id === "1" ? "15" : "16"}:00:00Z`,
});
const entries = [
  make("1", "won", 10, 2),
  make("2", "lost", 5, 1.5),
  make("3", "refunded", 20, 3),
  make("4", "pending", 30, 2.5),
];
it("calculates ROI and accuracy using wins/losses, counts refunds and open exposure separately", () => {
  expect(metrics(entries)).toMatchObject({
    total: 4,
    settled: 2,
    won: 1,
    lost: 1,
    pending: 1,
    refunded: 1,
    volume: 15,
    gains: 10,
    losses: 5,
    net: 5,
    returns: 20,
    accuracy: 50,
    exposure: 30,
    averageStake: 7.5,
    averageOdds: 1.75,
    maxDrawdown: 5,
  });
  expect(metrics(entries).roi).toBeCloseTo(33.333333);
  expect(metrics([entries[2], entries[3]])).toMatchObject({
    roi: null,
    accuracy: null,
    net: 0,
  });
});
it("uses non-overlapping odds intervals at every boundary", () => {
  for (const [odd, key] of [
    [1, "1"],
    [1.499, "1"],
    [1.5, "1.5"],
    [1.749, "1.5"],
    [1.75, "1.75"],
    [2, "2"],
    [2.5, "2.5"],
    [3, "3"],
    [4, "4"],
    [5, "5"],
    [9.99, "5"],
    [10, "10"],
    [25, "10"],
  ] as const)
    expect(oddsBand(odd).key).toBe(key);
});
it("groups markets across lines, retains exact selections and counts each match once per participant", () => {
  const data = [
    ...entries,
    make("5", "won", 10, 2, "Gols · A · Mais de 1,5 · 1º tempo"),
  ];
  expect(groupEntries(data, "market", catalog)).toHaveLength(1);
  expect(groupEntries(data, "selection", catalog)).toHaveLength(2);
  const teams = groupEntries(data, "team", catalog);
  expect(teams).toHaveLength(2);
  expect(teams[0].net).toBe(15);
  expect(teams[0].total).toBe(5);
  expect(groupEntries(data, "period", catalog)).toHaveLength(2);
});
it("filters, drills into groups, and opens the correct underlying entry", async () => {
  const u = userEvent.setup(),
    detail = vi.fn();
  render(
    <AnalyticsPage
      entries={[
        ...entries,
        make(
          "5",
          "lost",
          20,
          4,
          "Escanteios · Total do jogo · Mais de 9,5 · Jogo inteiro",
        ),
      ]}
      catalog={catalog}
      baseBankroll={102}
      onDetail={detail}
    />,
  );
  expect(screen.getByText("Inicial + aportes: R$ 102.00")).toBeTruthy();
  await selectOption(u, screen.getByLabelText("Mercado"), "Gols");
  await u.click(screen.getByRole("button", { name: "Gols", exact: true }));
  const group = screen.getByRole("region", { name: "Entradas do grupo" });
  expect(
    within(group).getAllByRole("button", { name: "Detalhar A × B" }),
  ).toHaveLength(4);
  await u.click(
    within(group).getAllByRole("button", { name: "Detalhar A × B" })[0],
  );
  expect(detail).toHaveBeenCalledWith(
    expect.objectContaining({ catalog_id: "league" }),
  );
  await u.click(screen.getByRole("tab", { name: "Faixas de odds" }));
  expect(
    screen.queryByRole("region", { name: "Entradas do grupo" }),
  ).toBeNull();
  expect(
    screen.getByRole("button", { name: "2,00 ≤ odd < 2,50", exact: true }),
  ).toBeTruthy();
  await u.click(screen.getByRole("button", { name: "Limpar filtros" }));
  expect(screen.getByText("Inicial + aportes: R$ 102.00")).toBeTruthy();
});
