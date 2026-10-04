import { afterEach, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import SearchableSelect from "../src/SearchableSelect";
afterEach(cleanup);
function Fixture() {
  const [v, setV] = useState("");
  return (
    <>
      <label>
        Seleção
        <SearchableSelect
          required
          value={v}
          onChange={(e) => setV(e.target.value)}
        >
          <option value="">Pesquisar seleção</option>
          <option value="greece">Grécia</option>
          <option value="germany">Alemanha</option>
          <option value="brazil">Brasil</option>
        </SearchableSelect>
      </label>
      <output aria-label="Valor escolhido">{v}</output>
    </>
  );
}
it("filters without accents and selects using the keyboard", async () => {
  const u = userEvent.setup();
  render(<Fixture />);
  const input = screen.getByLabelText("Seleção");
  await u.type(input, "grecia");
  expect(screen.getByRole("option", { name: "Grécia" })).toBeTruthy();
  expect(screen.queryByRole("option", { name: "Alemanha" })).toBeNull();
  await u.keyboard("{Enter}");
  expect(screen.getByLabelText("Valor escolhido").textContent).toBe("greece");
  expect((input as HTMLInputElement).value).toBe("Grécia");
  expect(screen.queryByRole("listbox")).toBeNull();
});
it("rejects arbitrary text, reports no matches and clears stale selection", async () => {
  const u = userEvent.setup();
  render(<Fixture />);
  const input = screen.getByLabelText("Seleção") as HTMLInputElement;
  await u.click(input);
  await u.click(screen.getByRole("option", { name: "Brasil" }));
  expect(input.checkValidity()).toBe(true);
  await u.click(input);
  await u.type(input, "inexistente");
  expect(screen.getByText("Nenhuma opção encontrada.")).toBeTruthy();
  expect(screen.getByLabelText("Valor escolhido").textContent).toBe("");
  expect(input.checkValidity()).toBe(false);
  await u.keyboard("{Escape}");
  expect(screen.queryByRole("listbox")).toBeNull();
});
it("supports decimal search with a dot for comma-formatted lines", async () => {
  const u = userEvent.setup();
  render(
    <SearchableSelect aria-label="Linha" value="" onChange={() => {}}>
      <option value="0.75">0,75</option>
      <option value="1.25">1,25</option>
    </SearchableSelect>,
  );
  await u.type(screen.getByLabelText("Linha"), "0.75");
  expect(screen.getByRole("option", { name: "0,75" })).toBeTruthy();
  expect(screen.queryByRole("option", { name: "1,25" })).toBeNull();
});
