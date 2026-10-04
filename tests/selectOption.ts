import { within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
export async function selectOption(
  user: UserEvent,
  element: HTMLElement,
  value: string,
) {
  await user.click(element);
  const root = element.closest(".search-select")!;
  const option = Array.from(
    root.querySelectorAll<HTMLElement>("[role=option]"),
  ).find((o) => o.dataset.value === value);
  if (!option) throw Error("Option not found: " + value);
  await user.click(option);
}
