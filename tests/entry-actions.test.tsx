import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EntryTable from "../src/EntryTable";
vi.mock("../src/lib", () => ({
  money: (n: number) => String(n),
  date: (s: string) => s,
  profit: () => 0,
  statusName: { pending: "Em aberto" },
}));
afterEach(cleanup);
it("opens edit, delete or details for the selected row", async () => {
  const entry = {
    id: "one",
    catalog_id: "league",
    home: "Grécia",
    away: "Alemanha",
    market: "Gols",
    stake: 10,
    odds: 1.52,
    status: "pending",
    bookmaker: "",
    notes: "",
    event_at: "2026-10-04T14:00:00Z",
    created_at: "2026-10-04T14:00:00Z",
    settled_at: null,
  };
  const edit = vi.fn(),
    remove = vi.fn(),
    detail = vi.fn(),
    user = userEvent.setup();
  render(
    <EntryTable
      data={[entry]}
      catalog={[]}
      search=""
      filter="all"
      balance={100}
      onEdit={edit}
      onDelete={remove}
      onDetail={detail}
      onStart={() => {}}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Editar Grécia × Alemanha" }),
  );
  expect(edit).toHaveBeenCalledWith(entry);
  await user.click(
    screen.getByRole("button", { name: "Apagar Grécia × Alemanha" }),
  );
  expect(remove).toHaveBeenCalledWith(entry);
  await user.click(
    screen.getByRole("button", { name: "Detalhar Grécia × Alemanha" }),
  );
  expect(detail).toHaveBeenCalledWith(entry);
});
