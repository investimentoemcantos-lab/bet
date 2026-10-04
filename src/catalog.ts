import type { Competition } from "./lib";
export function selectableCatalog(catalog: Competition[]) {
  return catalog
    .filter((c) => c.selectable !== false)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
export function competitionsFor(
  catalog: Competition[],
  kind: string,
  country: string,
) {
  return selectableCatalog(catalog).filter(
    (c) => c.kind === kind && (kind === "national" || c.country === country),
  );
}
