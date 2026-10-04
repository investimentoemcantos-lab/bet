import { afterEach, it, expect, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BetForm from "../src/BetForm";
import data from "../src/catalog.json";
import { competitionsFor } from "../src/catalog";
import type { Competition } from "../src/lib";
const place = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("../src/lib", () => ({
  command: place,
  money: (n: number) => `R$ ${n.toFixed(2)}`,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("registers Greece vs Germany in UEFA Nations League A with over 3.5 cards", async () => {
  const u = userEvent.setup();
  const saved = vi.fn().mockResolvedValue(undefined);
  render(
    <BetForm
      catalog={data as Competition[]}
      balance={100}
      onClose={() => {}}
      onSaved={saved}
    />,
  );
  await u.click(screen.getByRole("button", { name: "Seleções" }));
  expect(screen.queryByLabelText("País")).toBeNull();
  expect(screen.queryByLabelText("País-sede da competição")).toBeNull();
  expect(
    (screen.getByLabelText("Competição") as HTMLSelectElement).disabled,
  ).toBe(false);
  const league = data.find(
    (c) => c.name === "Liga das Nações da UEFA A · 2026/27",
  )!;
  await u.selectOptions(screen.getByLabelText("Competição"), league.id);
  await u.selectOptions(screen.getByLabelText("Seleção 1"), "Grécia");
  await u.selectOptions(screen.getByLabelText("Seleção 2"), "Alemanha");
  await u.selectOptions(screen.getByLabelText("Mercado"), "cards");
  await u.selectOptions(screen.getByLabelText("Mais ou menos"), "over");
  await u.selectOptions(screen.getByLabelText("Linha"), "3.5");
  await u.type(screen.getByLabelText("Valor da entrada (R$)"), "10");
  await u.type(screen.getByLabelText("Odd decimal"), "1.77");
  await u.click(screen.getByRole("button", { name: "Registrar entrada" }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(place).toHaveBeenCalledWith(
    "place",
    expect.objectContaining({
      catalog_id: league.id,
      home: "Grécia",
      away: "Alemanha",
      stake: 10,
      odds: 1.77,
      market: "Cartões · Total do jogo · Mais de 3,5 · Jogo inteiro",
    }),
    expect.any(String),
  );
});
it("shows one unified friendly competition with all participants instead of host-specific duplicates", () => {
  const national = competitionsFor(data as Competition[], "national", "");
  expect(national.every((c) => c.selectable !== false)).toBe(true);
  const friendlies = national.filter(
    (c) => c.name === "Amistosos internacionais",
  );
  expect(friendlies).toHaveLength(1);
  expect(friendlies[0].teams).toEqual(
    expect.arrayContaining(["Grécia", "Alemanha", "Brasil", "Argentina"]),
  );
  expect(national.some((c) => c.name === "Friendly")).toBe(false);
  expect(new Set(national.map((c) => c.name)).size).toBe(national.length);
});
