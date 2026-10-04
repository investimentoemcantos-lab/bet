import { selectOption } from "./selectOption";
import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import MarketPicker from "../src/MarketPicker";
import { emptyMarket, marketLabel, MARKETS, marketLines } from "../src/markets";
afterEach(cleanup);
function Fixture() {
  const [v, setV] = useState(emptyMarket);
  return (
    <MarketPicker value={v} onChange={setV} home="Flamengo" away="Palmeiras" />
  );
}
describe("Market and line selection", () => {
  it("lets users select Over/Under quarter lines and switch period and team", async () => {
    const u = userEvent.setup();
    render(<Fixture />);
    await selectOption(u, screen.getByLabelText("Mercado"), "goals");
    await u.click(screen.getByLabelText("Linha"));
    for (const n of ["0,5", "0,75", "1", "1,25"])
      expect(screen.getByRole("option", { name: n, exact: true })).toBeTruthy();
    await selectOption(u, screen.getByLabelText("Mais ou menos"), "under");
    await selectOption(u, screen.getByLabelText("Linha"), "0.75");
    await selectOption(u, screen.getByLabelText("Período"), "first");
    await selectOption(u, screen.getByLabelText("Aplicar a"), "home");
    expect(screen.getByLabelText("Entrada selecionada").textContent).toBe(
      "Gols · Flamengo · Menos de 0,75 · 1º tempo",
    );
  });
  it("selects Lithuania to win corners 1X2 without an over/under line", async () => {
    function Match() {
      const [v, setV] = useState(emptyMarket);
      return (
        <MarketPicker
          value={v}
          onChange={setV}
          home="Azerbaijão"
          away="Lituânia"
        />
      );
    }
    const u = userEvent.setup();
    render(<Match />);
    await selectOption(u, screen.getByLabelText("Mercado"), "corners_result");
    expect(screen.queryByLabelText("Linha")).toBeNull();
    expect(screen.queryByLabelText("Mais ou menos")).toBeNull();
    await u.click(screen.getByLabelText("Seleção"));
    expect(
      screen.getByRole("option", { name: "Vitória de Lituânia (2)" }),
    ).toBeTruthy();
    expect(screen.getByRole("option", { name: "Empate (X)" })).toBeTruthy();
    await selectOption(u, screen.getByLabelText("Seleção"), "away");
    expect(screen.getByLabelText("Entrada selecionada").textContent).toBe(
      "Escanteios — resultado (1X2) · Vitória de Lituânia (2) · Jogo inteiro",
    );
    await selectOption(u, screen.getByLabelText("Período"), "first");
    expect(screen.getByLabelText("Entrada selecionada").textContent).toContain(
      "1º tempo",
    );
  });
  it("clears incompatible line and selection when changing market", async () => {
    const u = userEvent.setup();
    render(<Fixture />);
    await selectOption(u, screen.getByLabelText("Mercado"), "corners");
    await selectOption(u, screen.getByLabelText("Mais ou menos"), "over");
    await selectOption(u, screen.getByLabelText("Linha"), "10.25");
    await selectOption(u, screen.getByLabelText("Mercado"), "btts");
    expect(screen.queryByLabelText("Linha")).toBeNull();
    expect((screen.getByLabelText("Seleção") as HTMLSelectElement).value).toBe(
      "",
    );
    expect(screen.queryByLabelText("Entrada selecionada")).toBeNull();
    await selectOption(u, screen.getByLabelText("Seleção"), "yes");
    expect(screen.getByLabelText("Entrada selecionada").textContent).toBe(
      "Ambas marcam · Sim · Jogo inteiro",
    );
  });
  it("supports signed Asian handicap lines and custom lines", async () => {
    const u = userEvent.setup();
    render(<Fixture />);
    await selectOption(u, screen.getByLabelText("Mercado"), "asian_handicap");
    await selectOption(u, screen.getByLabelText("Seleção"), "away");
    await selectOption(u, screen.getByLabelText("Linha"), "-0.75");
    expect(screen.getByLabelText("Entrada selecionada").textContent).toBe(
      "Handicap asiático · Palmeiras -0,75 · Jogo inteiro",
    );
    await selectOption(u, screen.getByLabelText("Linha"), "custom");
    await u.type(screen.getByLabelText("Linha personalizada"), "5.25");
    expect(screen.getByLabelText("Entrada selecionada").textContent).toContain(
      "Palmeiras +5,25",
    );
  });
  it("supports both teams with negative, positive, zero and custom corner handicaps", async () => {
    const u = userEvent.setup();
    render(<Fixture />);
    await selectOption(
      u,
      screen.getByLabelText("Mercado"),
      "corners_asian_handicap",
    );
    expect(screen.queryByLabelText("Mais ou menos")).toBeNull();
    await selectOption(u, screen.getByLabelText("Seleção"), "home");
    await selectOption(u, screen.getByLabelText("Linha"), "-1.5");
    expect(screen.getByLabelText("Entrada selecionada").textContent).toBe(
      "Escanteios — handicap asiático · Flamengo -1,5 · Jogo inteiro",
    );
    await selectOption(u, screen.getByLabelText("Seleção"), "away");
    await selectOption(u, screen.getByLabelText("Linha"), "1.25");
    await selectOption(u, screen.getByLabelText("Período"), "first");
    expect(screen.getByLabelText("Entrada selecionada").textContent).toBe(
      "Escanteios — handicap asiático · Palmeiras +1,25 · 1º tempo",
    );
    await selectOption(u, screen.getByLabelText("Linha"), "0");
    expect(screen.getByLabelText("Entrada selecionada").textContent).toContain(
      "Palmeiras 0",
    );
    await selectOption(u, screen.getByLabelText("Linha"), "custom");
    await u.type(screen.getByLabelText("Linha personalizada"), "-21.5");
    expect(screen.getByLabelText("Entrada selecionada").textContent).toContain(
      "Palmeiras -21,5",
    );
    expect(
      marketLabel(
        {
          ...emptyMarket(),
          type: "corners_asian_handicap",
          selection: "draw",
          line: "1",
        },
        "A",
        "B",
      ),
    ).toBe("");
  });
  it("rejects missing directions, invalid steps and fractional exact goals", () => {
    const base = { ...emptyMarket(), type: "goals", line: "0.75" };
    expect(marketLabel(base, "A", "B")).toBe("");
    expect(
      marketLabel({ ...base, selection: "over", line: "0.6" }, "A", "B"),
    ).toBe("");
    expect(marketLabel({ ...base, type: "exact_goals" }, "A", "B")).toBe("");
    expect(marketLabel({ ...base, selection: "over" }, "A", "B")).toContain(
      "Mais de 0,75",
    );
    expect(
      marketLines(MARKETS.find((m) => m.id === "european_handicap")!).every(
        Number.isInteger,
      ),
    ).toBe(true);
  });
  it("handles correct score without a totals line", async () => {
    const u = userEvent.setup();
    render(<Fixture />);
    await selectOption(u, screen.getByLabelText("Mercado"), "correct_score");
    await u.type(screen.getByLabelText("Gols da equipe 1"), "2");
    await u.type(screen.getByLabelText("Gols da equipe 2"), "1");
    expect(screen.getByLabelText("Entrada selecionada").textContent).toBe(
      "Placar exato · 2 × 1 · Jogo inteiro",
    );
    expect(screen.queryByLabelText("Linha")).toBeNull();
  });
});
