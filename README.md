# VG Generator

En **parodi** på norske løssalgsaviser (VG / Dagbladet). Nettsiden ser ut som en
ekte tabloid-forside, men alt innholdet er oppdiktet og skrevet av en **lokal LLM**
via et OpenAI-kompatibelt API. Ingen backend – artiklene ligger som statiske
JSON-filer og/eller genereres rett i nettleseren.

> ⚠️ Alt innhold er tull og fiksjon. Ikke tilknyttet VG eller Dagbladet.

## Slik funker det

- **Forsiden, seksjoner og artikkelvisning** er en React + Vite-app stylet som VG.
- **Artikler** lagres som JSON under [public/articles/](public/articles/): en
  `index.json` (nyeste først) + én fil per sak. Nettleseren `fetch`-er dem.
- **Bilder** er tilfeldige, forhåndslastede bilder i [public/images/](public/images/).
  Hver artikkel får et bilde **deterministisk** ut fra sin id (djb2-hash), så samme
  sak alltid viser samme bilde.
- **Generering** skjer på to måter, begge mot en lokal OpenAI-kompatibel server
  (standard `http://127.0.0.1:8000/v1`, f.eks. MLX / `mlx_lm.server`):
  1. **Knapp i nettleseren** – «✨ Generer nyheter» øverst til høyre. Nye saker
     lagres i `localStorage` og flettes inn i strømmen.
  2. **Node-skript** – skriver nye JSON-filer til `public/articles/`.

Selve **redaksjonelle stilen** (overskriftsmønstre, ingress, sitater, seksjoner)
er kodet som systemprompt i [prompts/system-prompt.md](prompts/system-prompt.md) –
samme fil brukes av både nettleseren og Node-skriptet.

## Kom i gang

```bash
yarn            # installer
yarn seed       # (valgfritt) skriv 12 håndlagde eksempelsaker – kjøres allerede
yarn dev        # start dev-server på http://localhost:5173
```

Appen har allerede seed-innhold, så den funker uten LLM.

### Generere ekte LLM-innhold

Serveren i dette oppsettet krever en **API-nøkkel**.

**I nettleseren:** trykk tannhjulet ⚙ ved siden av «Generer nyheter», fyll inn
API-nøkkel (og evt. base-URL / modell), lagre – og trykk «Generer nyheter».
I dev proxyer Vite `/llm` → `http://127.0.0.1:8000` slik at nettleseren slipper
CORS (se [vite.config.ts](vite.config.ts)).

**Som filer på disk:**

```bash
LLM_API_KEY=din-nøkkel yarn generate --count 8
# valgfritt: --sections nyheter,sport,forbruker
# env: LLM_BASE_URL (default http://127.0.0.1:8000/v1), LLM_MODEL (default: første modell)
```

Skriptet henter modell-liste fra `/v1/models`, ber modellen om JSON, og skriver
sakene til `public/articles/` + oppdaterer `index.json`.

## Prosjektstruktur

```text
prompts/
  system-prompt.md    # redaksjonell stil (delt kilde for nettleser + node)
  sections.json       # seksjoner + forfatternavn (node-siden)
scripts/
  store.mjs           # delte hjelpere: bilde-hash, skjema, skriv JSON, index
  seed.mjs            # håndlagde eksempelsaker
  generate.mjs        # LLM-generator som skriver JSON-filer
public/
  articles/           # index.json + én JSON-fil per sak
  images/             # 24 tilfeldige bilder (picsum.photos)
src/
  lib/                # typer, ruter, datalasting, LLM-klient, prompt
  components/         # Header, FrontPage, SectionPage, ArticleView, GeneratePanel …
```

## Kommandoer

| Kommando         | Hva                                             |
| ---------------- | ----------------------------------------------- |
| `yarn dev`       | Dev-server med HMR + `/llm`-proxy               |
| `yarn build`     | Typecheck + produksjonsbygg                     |
| `yarn preview`   | Server produksjonsbygget                        |
| `yarn seed`      | Skriv eksempelsaker til `public/articles/`      |
| `yarn generate`  | Generer saker med lokal LLM → JSON-filer        |
| `yarn lint`      | Oxlint                                          |
