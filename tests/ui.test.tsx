import { selectOption } from "./selectOption";
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BetForm from "../src/BetForm";
import Auth from "../src/Auth";
const calls = vi.hoisted(() => ({
  command: vi.fn().mockResolvedValue(undefined),
  login: vi.fn().mockResolvedValue({ error: null }),
  signup: vi.fn().mockResolvedValue({ error: null }),
  reset: vi.fn().mockResolvedValue({ error: null }),
}));
vi.mock("../src/lib", () => ({
  command: calls.command,
  money: (v: number) => `R$ ${v.toFixed(2)}`,
  supabase: {
    auth: {
      signInWithPassword: calls.login,
      signUp: calls.signup,
      resetPasswordForEmail: calls.reset,
    },
  },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const catalog = [
  {
    id: "br",
    kind: "clubs",
    country: "Brasil",
    name: "Brasileirão",
    teams: ["Flamengo", "Palmeiras"],
    source: "https://example.com",
    updated_at: "2026-10-04",
  },
  {
    id: "en",
    kind: "clubs",
    country: "Inglaterra",
    name: "Premier League",
    teams: ["Arsenal", "Chelsea"],
    source: "https://example.com",
    updated_at: "2026-10-04",
  },
  {
    id: "nat",
    kind: "national",
    country: "Internacional",
    name: "Amistosos internacionais",
    teams: ["Brasil", "Argentina"],
    source: "https://example.com",
    updated_at: "2026-10-04",
  },
];
describe("Entry workflow", () => {
  it("cascades selectors, disallows duplicate teams, calculates return and submits", async () => {
    const user = userEvent.setup();
    const saved = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn();
    render(
      <BetForm
        catalog={catalog}
        balance={1000}
        onClose={close}
        onSaved={saved}
      />,
    );
    await selectOption(user, screen.getByLabelText("País"), "Brasil");
    await selectOption(user, screen.getByLabelText("Competição"), "br");
    await selectOption(user, screen.getByLabelText("Equipe 1"), "Flamengo");
    await user.click(screen.getByLabelText("Equipe 2"));
    expect(screen.queryByRole("option", { name: "Flamengo" })).toBeNull();
    await selectOption(user, screen.getByLabelText("Equipe 2"), "Palmeiras");
    await selectOption(user, screen.getByLabelText("Mercado"), "goals");
    await selectOption(user, screen.getByLabelText("Mais ou menos"), "over");
    await selectOption(user, screen.getByLabelText("Linha"), "2.5");
    await user.type(screen.getByLabelText("Valor da entrada (R$)"), "100");
    await user.type(screen.getByLabelText("Odd decimal"), "2");
    expect(screen.getByText("R$ 200.00")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Registrar entrada" }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(calls.command).toHaveBeenCalledWith(
      "place",
      expect.objectContaining({
        catalog_id: "br",
        home: "Flamengo",
        away: "Palmeiras",
        stake: 100,
        odds: 2,
        market: "Gols · Total do jogo · Mais de 2,5 · Jogo inteiro",
      }),
      expect.any(String),
    );
    expect(close).toHaveBeenCalledOnce();
  });
  it("edits an existing odd without replacing its market or result", async () => {
    const user = userEvent.setup();
    const entry = {
      id: "entry-id",
      catalog_id: "br",
      home: "Flamengo",
      away: "Palmeiras",
      market: "Gols · Total do jogo · Mais de 2,5 · Jogo inteiro",
      stake: 10,
      odds: 1.52,
      status: "won",
      bookmaker: "Casa",
      notes: "Análise",
      event_at: "2026-10-04T14:00:00Z",
      created_at: "2026-10-04T12:00:00Z",
      settled_at: "2026-10-04T15:00:00Z",
    };
    render(
      <BetForm
        entry={entry}
        catalog={catalog}
        balance={0}
        onClose={() => {}}
        onSaved={async () => {}}
      />,
    );
    expect(
      (screen.getByLabelText("Odd decimal") as HTMLInputElement).value,
    ).toBe("1.52");
    await user.clear(screen.getByLabelText("Odd decimal"));
    await user.type(screen.getByLabelText("Odd decimal"), "1.58");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() =>
      expect(calls.command).toHaveBeenCalledWith(
        "edit",
        expect.objectContaining({
          id: entry.id,
          odds: 1.58,
          stake: 10,
          market: entry.market,
          bookmaker: "Casa",
          notes: "Análise",
        }),
        expect.any(String),
      ),
    );
  });
  it("resets downstream selection when switching country or kind", async () => {
    const user = userEvent.setup();
    render(
      <BetForm
        catalog={catalog}
        balance={1000}
        onClose={() => {}}
        onSaved={async () => {}}
      />,
    );
    await selectOption(user, screen.getByLabelText("País"), "Brasil");
    await selectOption(user, screen.getByLabelText("Competição"), "br");
    await selectOption(user, screen.getByLabelText("Equipe 1"), "Flamengo");
    await selectOption(user, screen.getByLabelText("País"), "Inglaterra");
    expect((screen.getByLabelText("Equipe 1") as HTMLSelectElement).value).toBe(
      "",
    );
    expect(
      (screen.getByLabelText("Competição") as HTMLSelectElement).value,
    ).toBe("");
    await user.click(screen.getByRole("button", { name: "Seleções" }));
    expect(screen.queryByLabelText("País-sede da competição")).toBeNull();
    expect(screen.queryByLabelText("País")).toBeNull();
    await selectOption(user, screen.getByLabelText("Competição"), "nat");
    await user.click(screen.getByLabelText("Seleção 1"));
    expect(screen.getByRole("option", { name: "Brasil" })).toBeTruthy();
  });
  it("prevents registering an entry without available funds", () => {
    render(
      <BetForm
        catalog={catalog}
        balance={0}
        onClose={() => {}}
        onSaved={async () => {}}
      />,
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Registrar entrada",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
describe("Authentication", () => {
  it("sends login to Supabase and shows failures", async () => {
    calls.login.mockResolvedValueOnce({
      error: new Error("Credenciais inválidas"),
    });
    const user = userEvent.setup();
    render(<Auth />);
    await user.type(screen.getByLabelText("E-mail"), "user@example.com");
    await user.type(screen.getByLabelText("Senha"), "password123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Credenciais inválidas",
      ),
    );
    expect(calls.login).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password123",
    });
  });
  it("offers email confirmation after signup", async () => {
    const user = userEvent.setup();
    render(<Auth />);
    await user.click(screen.getByRole("button", { name: "Criar uma conta" }));
    await user.type(screen.getByLabelText("E-mail"), "user@example.com");
    await user.type(screen.getByLabelText("Senha"), "password123");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Confira seu e-mail",
      ),
    );
    expect(calls.signup).toHaveBeenCalledOnce();
  });
});
