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
    country: "Brasil",
    name: "Amistosos",
    teams: ["Brazil", "Argentina"],
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
    await user.selectOptions(screen.getByLabelText("País"), "Brasil");
    await user.selectOptions(screen.getByLabelText("Competição"), "br");
    await user.selectOptions(screen.getByLabelText("Equipe 1"), "Flamengo");
    expect(
      Array.from(
        (screen.getByLabelText("Equipe 2") as HTMLSelectElement).options,
      ).some((o) => o.value === "Flamengo"),
    ).toBe(false);
    await user.selectOptions(screen.getByLabelText("Equipe 2"), "Palmeiras");
    await user.selectOptions(screen.getByLabelText("Mercado"), "goals");
    await user.selectOptions(screen.getByLabelText("Mais ou menos"), "over");
    await user.selectOptions(screen.getByLabelText("Linha"), "2.5");
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
    await user.selectOptions(screen.getByLabelText("País"), "Brasil");
    await user.selectOptions(screen.getByLabelText("Competição"), "br");
    await user.selectOptions(screen.getByLabelText("Equipe 1"), "Flamengo");
    await user.selectOptions(screen.getByLabelText("País"), "Inglaterra");
    expect((screen.getByLabelText("Equipe 1") as HTMLSelectElement).value).toBe(
      "",
    );
    expect(
      (screen.getByLabelText("Competição") as HTMLSelectElement).value,
    ).toBe("");
    await user.click(screen.getByRole("button", { name: "Seleções" }));
    await user.selectOptions(
      screen.getByLabelText("País-sede da competição"),
      "Brasil",
    );
    await user.selectOptions(screen.getByLabelText("Competição"), "nat");
    expect(screen.getAllByRole("option", { name: "Brazil" })).toBeTruthy();
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
