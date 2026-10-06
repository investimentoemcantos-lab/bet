import { afterEach, describe, it, expect, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SportsPage from "../src/sports/SportsPage";
import { selectOption } from "./selectOption";
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  toggle: vi.fn(),
  saveNote: vi.fn().mockResolvedValue(true),
}));
vi.mock("../src/sports/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/sports/api")>();
  return { ...actual, sportsRequest: mocks.request };
});
vi.mock("../src/sports/useWatchlist", () => ({
  useWatchlist: () => ({
    items: [],
    notes: {},
    error: "",
    busy: false,
    toggle: mocks.toggle,
    saveNote: mocks.saveNote,
  }),
}));
const raw = (
  id: number,
  league: string,
  home: string,
  away: string,
  goals: [number | null, number | null] = [null, null],
) => ({
  fixture: {
    id,
    date: "2026-10-06T20:00:00Z",
    status: { short: goals[0] === null ? "NS" : "FT" },
  },
  league: {
    id: league === "Liga A" ? 10 : 20,
    name: league,
    country: "Brasil",
    season: 2026,
  },
  teams: {
    home: { id: id * 10, name: home },
    away: { id: id * 10 + 1, name: away },
  },
  goals: { home: goals[0], away: goals[1] },
});
const response = (rows: unknown[]) => ({
  response: rows,
  fetchedAt: "2026-10-06T19:00:00Z",
  cached: false,
  stale: false,
  remaining: 75,
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("Sports work panel", () => {
  it("loads real provider responses, filters/searches and opens analysis without continuous polling", async () => {
    mocks.request.mockImplementation(async (action: string) =>
      action === "status"
        ? response([{ configured: true, remaining: 80 }])
        : action === "fixtures"
          ? response([
              raw(1, "Liga A", "Uruguai", "Chile"),
              raw(2, "Liga B", "Palmeiras", "Santos"),
            ])
          : response([]),
    );
    const user = userEvent.setup();
    render(<SportsPage userId="user" />);
    await screen.findByRole("button", { name: /17:00.*Uruguai/ });
    await selectOption(
      user,
      screen.getByRole("combobox", { name: "Campeonato" }),
      "10",
    );
    expect(screen.queryByRole("button", { name: /Palmeiras/ })).toBeNull();
    await selectOption(
      user,
      screen.getByRole("combobox", { name: "Campeonato" }),
      "all",
    );
    await user.type(
      screen.getByPlaceholderText("Time, seleção, campeonato ou país"),
      "uruguai",
    );
    expect(screen.queryByRole("button", { name: /Palmeiras/ })).toBeNull();
    await user.click(
      screen.getByRole("button", {
        name: "Adicionar aos favoritos: Uruguai × Chile",
      }),
    );
    expect(mocks.toggle).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: /17:00.*Uruguai/ }));
    await screen.findAllByText("Sem resultados nesta amostra", { exact: true });
    await waitFor(() =>
      expect(
        mocks.request.mock.calls.filter((c) => c[0] === "history"),
      ).toHaveLength(2),
    );
    expect(
      mocks.request.mock.calls.filter((c) => c[0] === "fixtures"),
    ).toHaveLength(1);
    await user.click(screen.getByRole("tab", { name: "Minha análise" }));
    await user.type(screen.getByLabelText("Análise"), "Observar cantos");
    await user.click(screen.getByRole("button", { name: "Salvar análise" }));
    expect(mocks.saveNote).toHaveBeenCalledWith(
      expect.anything(),
      "Observar cantos",
    );
  });
  it("shows a missing-connection state without fake fixtures or unnecessary calls", async () => {
    mocks.request.mockResolvedValue(
      response([{ configured: false, remaining: 80 }]),
    );
    render(<SportsPage userId="user" />);
    await screen.findByText("Sua central está pronta para conectar os jogos");
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(
      (
        screen.getByRole("button", {
          name: "Consultar jogos",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
  it("does not show yesterday's results after a failed date lookup", async () => {
    mocks.request.mockImplementation(
      async (action: string, p: { date?: string }) => {
        if (action === "status")
          return response([{ configured: true, remaining: 80 }]);
        if (p.date === "2026-10-01") throw new Error("Cota esgotada");
        return response([raw(1, "Liga A", "Uruguai", "Chile")]);
      },
    );
    render(<SportsPage userId="user" />);
    await screen.findByRole("button", { name: /17:00.*Uruguai/ });
    fireEvent.change(screen.getByLabelText("Data dos jogos"), {
      target: { value: "2026-10-01" },
    });
    await screen.findByText("Cota esgotada");
    expect(screen.queryByRole("button", { name: /17:00.*Uruguai/ })).toBeNull();
  });
});
