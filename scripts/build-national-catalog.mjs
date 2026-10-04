import fs from "node:fs";
import crypto from "node:crypto";
const catalog = JSON.parse(fs.readFileSync("src/catalog.json", "utf8"));
const regions = new Map();
const en = new Intl.DisplayNames("en", { type: "region" });
const pt = new Intl.DisplayNames("pt-BR", { type: "region" });
for (let a = 65; a <= 90; a++)
  for (let b = 65; b <= 90; b++) {
    const iso = String.fromCharCode(a, b);
    const name = en.of(iso);
    if (name !== iso) regions.set(name, pt.of(iso));
  }
const aliases = {
  England: "Inglaterra",
  Scotland: "Escócia",
  Wales: "País de Gales",
  "Northern Ireland": "Irlanda do Norte",
  "Republic of Ireland": "Irlanda",
  "Ivory Coast": "Costa do Marfim",
  "DR Congo": "República Democrática do Congo",
  Congo: "República do Congo",
  "Cape Verde": "Cabo Verde",
  "South Korea": "Coreia do Sul",
  "North Korea": "Coreia do Norte",
  "United States": "Estados Unidos",
  "United States Virgin Islands": "Ilhas Virgens Americanas",
  "British Virgin Islands": "Ilhas Virgens Britânicas",
  "Chinese Taipei": "Taiwan",
  Curaçao: "Curaçao",
  "São Tomé and Príncipe": "São Tomé e Príncipe",
  Vietnam: "Vietnã",
  Laos: "Laos",
  Russia: "Rússia",
  Turkey: "Turquia",
  "Czech Republic": "Tchéquia",
  Czechia: "Tchéquia",
  "Hong Kong": "Hong Kong",
  Macau: "Macau",
  Brunei: "Brunei",
  Kosovo: "Kosovo",
  Palestine: "Palestina",
  "Saint Kitts and Nevis": "São Cristóvão e Névis",
  "Saint Vincent and the Grenadines": "São Vicente e Granadinas",
  "Saint Lucia": "Santa Lúcia",
  "Timor-Leste": "Timor-Leste",
  Eswatini: "Eswatini",
  "Northern Cyprus": "Chipre do Norte",
  Zanzibar: "Zanzibar",
  "Tamil Eelam": "Tamil Eelam",
  Sápmi: "Sápmi",
  Abkhazia: "Abecásia",
  Artsakh: "Artsakh",
  Somaliland: "Somalilândia",
};
const translate = (n) => aliases[n] ?? regions.get(n) ?? n;
const names = {
  "AFC Asian Cup": "Copa da Ásia",
  "AFC Asian Cup qualification": "Eliminatórias da Copa da Ásia",
  "ASEAN Championship": "Campeonato da ASEAN",
  "ASEAN Championship qualification": "Eliminatórias do Campeonato da ASEAN",
  "African Cup of Nations": "Copa Africana de Nações",
  "African Cup of Nations qualification":
    "Eliminatórias da Copa Africana de Nações",
  "Al Ain International Cup": "Copa Internacional de Al Ain",
  "Arab Cup": "Copa Árabe",
  "Arab Cup qualification": "Eliminatórias da Copa Árabe",
  "Baltic Cup": "Copa Báltica",
  "CONCACAF Nations League": "Liga das Nações da CONCACAF",
  "CONCACAF Series": "Série CONCACAF",
  "CONIFA Asia Cup": "Copa da Ásia da CONIFA",
  "CONIFA European Football Cup": "Copa Europeia da CONIFA",
  "Canadian Shield": "Torneio Canadian Shield",
  "Copa América": "Copa América",
  "Copa América qualification": "Eliminatórias da Copa América",
  "Diamond Jubilee International Football Tournament":
    "Torneio Internacional Jubileu de Diamante",
  "EAFF Championship qualification": "Eliminatórias da Copa do Leste Asiático",
  "FIFA Series": "Série FIFA",
  "FIFA World Cup": "Copa do Mundo FIFA",
  "FIFA World Cup qualification": "Eliminatórias da Copa do Mundo",
  Friendly: "Amistosos internacionais",
  "Gold Cup": "Copa Ouro da CONCACAF",
  "Gold Cup qualification": "Eliminatórias da Copa Ouro",
  "Gulf Cup": "Copa do Golfo",
  "Intercontinental Cup": "Copa Intercontinental de Seleções",
  "Island Games": "Jogos das Ilhas",
  "King's Cup": "Copa do Rei da Tailândia",
  "Kirin Cup": "Copa Kirin",
  "MSG Prime Minister's Cup": "Copa do Primeiro-Ministro MSG",
  "Mapinduzi Cup": "Copa Mapinduzi",
  "Marianas Cup": "Copa das Marianas",
  "Merdeka Tournament": "Torneio Merdeka",
  "Morocco, Capital of African Football":
    "Marrocos — Capital do Futebol Africano",
  "Mukuru 4 Nations": "Torneio Mukuru Quatro Nações",
  "Oceania Nations Cup": "Copa das Nações da Oceania",
  "Oceania Nations Cup qualification":
    "Eliminatórias da Copa das Nações da Oceania",
  "Outrigger Challenge Cup": "Copa Desafio Outrigger",
  "Soccer Ashes": "Torneio Soccer Ashes",
  "South Asian Super Cup": "Supercopa do Sul da Ásia",
  "Tri-Nations Cup": "Copa Três Nações",
  "Tri-Nations Series": "Série Três Nações",
  "UEFA Euro": "Eurocopa",
  "UEFA Euro qualification": "Eliminatórias da Eurocopa",
  "UEFA Nations League": "Liga das Nações da UEFA (geral)",
  "Unity Cup": "Copa da Unidade",
};
const national = catalog.filter(
  (c) => c.kind === "national" && c.country !== "Internacional",
);
const groups = new Map();
for (const c of national) {
  const set = groups.get(c.name) ?? new Set();
  c.teams.forEach((n) => set.add(translate(n)));
  groups.set(c.name, set);
}
const source = "https://github.com/martj42/international_results";
const updated = new Date().toISOString().slice(0, 10);
const make = (name, teams, src = source) => ({
  id: crypto
    .createHash("sha256")
    .update("national|Internacional|" + name)
    .digest("hex")
    .slice(0, 24),
  kind: "national",
  country: "Internacional",
  name,
  teams: [...teams].sort((a, b) => a.localeCompare(b, "pt-BR")),
  source: src,
  updated_at: updated,
  selectable: true,
});
const canonical = [...groups].map(([name, teams]) =>
  make(names[name] ?? name, teams),
);
const uefa =
  "https://pt.uefa.com/uefanationsleague/news/029a-1de727221bb1-1c1abe24401c-1000--uefa-nations-league-2026-27-tudo-o-que-precisa-de-saber/";
// Official 2026/27 league allocations from UEFA, not inferred from host-country match history.
const divisions = {
  A: [
    "França",
    "Itália",
    "Bélgica",
    "Turquia",
    "Alemanha",
    "Países Baixos",
    "Sérvia",
    "Grécia",
    "Espanha",
    "Croácia",
    "Inglaterra",
    "Tchéquia",
    "Portugal",
    "Dinamarca",
    "Noruega",
    "País de Gales",
  ],
  B: [
    "Escócia",
    "Suíça",
    "Eslovênia",
    "Macedônia do Norte",
    "Hungria",
    "Ucrânia",
    "Geórgia",
    "Irlanda do Norte",
    "Israel",
    "Áustria",
    "Irlanda",
    "Kosovo",
    "Polônia",
    "Bósnia e Herzegovina",
    "Romênia",
    "Suécia",
  ],
  C: [
    "Albânia",
    "Finlândia",
    "Bielorrússia",
    "San Marino",
    "Montenegro",
    "Armênia",
    "Chipre",
    "Letônia",
    "Cazaquistão",
    "Eslováquia",
    "Ilhas Faroe",
    "Moldávia",
    "Islândia",
    "Bulgária",
    "Estônia",
    "Luxemburgo",
  ],
  D: [
    "Gibraltar",
    "Malta",
    "Andorra",
    "Lituânia",
    "Azerbaijão",
    "Liechtenstein",
  ],
};
for (const [division, teams] of Object.entries(divisions))
  canonical.push(
    make("Liga das Nações da UEFA " + division + " · 2026/27", teams, uefa),
  );
canonical.push(
  make(
    "Outra competição de seleções",
    new Set([...groups.values()].flatMap((s) => [...s])),
  ),
);
for (const c of national) c.selectable = false;
const final = [
  ...catalog.filter((c) => c.kind === "clubs"),
  ...national,
  ...canonical,
];
fs.writeFileSync("src/catalog.json", JSON.stringify(final, null, 2) + "\n");

const q = (s) => "'" + String(s).replaceAll("'", "''") + "'";
const statements = [
  "alter table public.bet_catalog add column selectable boolean not null default true;",
  "update public.bet_catalog set selectable=false where kind='national';",
  ...canonical.map(
    (c) =>
      `insert into public.bet_catalog(id,kind,country,name,teams,source,updated_at,selectable) values(${[c.id, c.kind, c.country, c.name].map(q).join(",")},${q(JSON.stringify(c.teams))}::jsonb,${q(c.source)},${q(c.updated_at)},true);`,
  ),
];
const migration = fs
  .readdirSync("supabase/migrations")
  .find((n) => n.endsWith("_national_competitions.sql"));
if (!migration) throw Error("Create migration with Supabase CLI first");
fs.writeFileSync(
  "supabase/migrations/" + migration,
  statements.join("\n") + "\n",
);
console.log({
  canonical: canonical.length,
  uefaA: canonical.find((c) => c.name.startsWith("Liga das Nações da UEFA A")),
});
