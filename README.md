# VG Generator

En **parodi** på norske løssalgsaviser (VG / Dagbladet). Nettsiden ser ut som en
ekte tabloid-forside, men alt innholdet er oppdiktet og skrevet av en **lokal LLM**
(f.eks. oMLX / MLX) via et OpenAI-kompatibelt API. En liten **Node-backend** kaller
modellen og lagrer sakene som JSON-filer på disk.

> ⚠️ Alt innhold er tull og fiksjon. Ikke tilknyttet VG eller Dagbladet.

## Arkitektur

```text
Nettleser (React/Vite)  ──/api──►  Node-backend  ──►  lokal LLM (oMLX, :8000)
      ▲                                  │
      └── leser JSON ◄───── skriver ─────┘
              public/articles/*.json
```

- **Frontend** ([src/](src/)): React + Vite, stylet som VG. Leser artikler som
  statiske JSON-filer.
- **Backend** ([server/index.mjs](server/index.mjs)): kaller LLM-en (API-nøkkel
  **server-side** fra `.env`), skriver sakene til [public/articles/](public/articles/)
  og oppdaterer `index.json`. Dermed ligger artiklene på disk og overlever
  omlasting/ny nettleser.
- **Bilder**: for hver genererte sak ber modellen om engelske søkeord
  (`imageQuery`), og backend laster ned et **relevant** foto (loremflickr /
  Flickr CC) til `public/images/gen/<id>.jpg`. Feiler nedlastingen, faller den
  tilbake på et forhåndslastet bilde i [public/images/](public/images/) valgt
  **deterministisk** ut fra sakens id (djb2-hash).
- **Redaksjonell stil**: kodet som systemprompt i
  [prompts/system-prompt.md](prompts/system-prompt.md).

## Kom i gang

```bash
yarn                     # installer
cp .env.example .env      # legg inn LLM_API_KEY (se under)
yarn dev                  # starter BÅDE backend (:8787) og nettside (:5173)
```

Appen har allerede seed-innhold, så forsiden funker selv uten LLM.

### API-nøkkel (oMLX)

oMLX krever en nøkkel for forespørsler. Finn den i oMLX under **General →
Security** (der kan du også slå av kravet). Legg den i `.env`:

```bash
LLM_API_KEY=din-nøkkel-her
```

Nøkkelen leses kun av backend – den sendes **aldri** til nettleseren, og du
skriver den inn **én gang**.

## Generere nyheter

Trykk **«✨ Generer nyheter»** øverst til høyre. I dialogen:

- velg **antall saker** – du får like mange **tema-felt**,
- skriv et tema per sak (eller la stå tomt for «fritt valg»),
- legg til **nøkkelord** under hvert tema (+ for å legge til, × for å fjerne,
  klikk for å redigere) – modellen skriver saken rundt dem. Backend sjekker
  at nøkkelordene faktisk kom med, og ber modellen skrive om saken én gang hvis
  ikke. Hvor godt de veves inn avhenger av modellen – større modeller treffer
  bedre (sett `LLM_MODEL`).
- **🎲 Foreslå temaer** lar modellen finne på temaer for deg,
- **Generer** skriver sakene til disk og oppdaterer forsiden.

### Fra kommandolinjen

```bash
yarn generate --count 8
yarn generate --count 4 --topics "måke tar pølse; strømpris i taket"
```

### Spinn dagens nyheter

På forsiden ligg knappen **«🗞️ Spinn nyheter»**. Den hentar ekte overskrifter
(kun overskriftene, som tema-frø) frå eit tilfeldig utval av VG, NRK, Dagbladet,
Aftenposten og Se og Hør, fjernar duplikat-emne, og let modellen spinne kvart
emne om til ein absurd, oppdikta parodi – med **fiktive** personar. Vel talet på
saker (6 som standard). Backend gjer jobben ([scripts/news.mjs](scripts/news.mjs)),
så ingen sidekode eller CORS.

## Les opp saker (text-to-speech)

Hver artikkel har en høyttaler-knapp **«Hør saken»** rett under bylinen. Den leser
overskrift, ingress og hele brødteksten på norsk via macOS sin innebygde
`say`-kommando – ingen oppsett, ingen Docker. Standardstemme er `Nora`
(`nb_NO`). Bytt stemme med `TTS_VOICE` i `.env` – `say -v '?'` lister alle
stemmer installert på maskinen. Slå av med `TTS_ENABLED=false`.

> Merk: dette er macOS-only (`say` finnes ikke på andre plattformer), men det
> er appen i sin helhet også.

## Kommandoer

| Kommando               | Hva                                                              |
| ---------------------- | ----------------------------------------------------------------- |
| `yarn dev`             | Backend + Vite (med `/api`-proxy) samtidig                       |
| `yarn dev:web`         | Bare Vite                                                        |
| `yarn server`          | Bare backend                                                     |
| `yarn build`           | Typecheck + produksjonsbygg                                      |
| `yarn preview`         | Server produksjonsbygget                                         |
| `yarn seed`            | Skriv håndlagde eksempelsaker til `public/articles/`             |
| `yarn generate`        | Generer saker med lokal LLM → JSON-filer                         |
| `yarn lint`            | Oxlint                                                           |
| `yarn electron:dev`    | Åpne et Electron-vindu mot en allerede kjørende `yarn dev`       |
| `yarn electron:start`  | Kjør hele den pakkede appflyten (bundlet LLM) uten full pakking  |
| `yarn electron:build`  | Bygg den ferdige macOS-appen (zip)                               |

## macOS-app (Electron)

VG Generator kan pakkes som en frittstående, dobbeltklikkbar macOS-app –
ingen oMLX, ingen Docker, ingen `.env`. Den lokale LLM-en (Llama-3.2-3B-Instruct,
Q4_K_M-kvantisert) kjører inni appen via en bundlet `llama-server`-binær
([llama.cpp](https://github.com/ggml-org/llama.cpp)), lastet ned første gang
appen starter.

```bash
yarn vendor:llama    # hent llama-server-binæren én gang (gitignored, .vendor/)
yarn electron:dev    # åpne et Electron-vindu mot en allerede kjørende `yarn dev`
yarn electron:start  # kjør hele appflyten (bundlet LLM + modell-nedlasting) uten full pakking
yarn electron:build  # bygg den ferdige .zip (pakk ut, dra .app til Programmer)
```

- **`yarn dev` er upåvirket** – Electron er kun et pakkingslag oppå den
  eksisterende utviklerflyten, ikke en erstatning for den.
- **Apple Silicon-only**: den bundlete `llama-server`-binæren er arm64/Metal.
  Appen sjekker dette og gir en tydelig feilmelding på Intel-Mac-er.
- **Første gang**: appen laster ned modellen (~2 GB) til
  `~/Library/Application Support/VG Generator/models/` med en fremdriftsskjerm.
  Genererte saker/bilder havner i samme mappes `data/`-undermappe – appens
  `.app`-pakke selv er skrivebeskyttet.
- **Usignert**: denne pakken signeres/notariseres ikke ennå (krever et Apple
  Developer ID). Gatekeeper vil derfor blokkere appen på andre sine Mac-er –
  høyreklikk → Åpne, eller `xattr -dr com.apple.quarantine "VG Generator.app"`,
  for å omgå dette inntil signering er på plass.

> **Modellvalg – lisens-fallgruve:** default-modellen er
> Llama-3.2-3B-Instruct-Q4_K_M ([bartowski/Llama-3.2-3B-Instruct-GGUF](https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF)),
> under Metas Llama 3.2 Community License (tillater redistribusjon). **Ikke**
> bytt denne til Qwen2.5-3B-Instruct som en "drop-in"-oppgradering – i
> motsetning til de andre Qwen2.5-størrelsene (1.5B/7B/14B/32B, alle
> Apache-2.0) er 3B-varianten lisensiert under Alibabas "qwen-research"-lisens
> (forskning/ikke-kommersielt, ikke redistribuerbar). Sjekk alltid lisensen på
> nytt før default-modellen endres.

## Prosjektstruktur

```text
prompts/
  system-prompt.md    # redaksjonell stil (delt kilde)
  sections.json       # seksjoner + forfatternavn
server/
  index.mjs           # /api/generate, /api/topics, /api/health, /api/tts
  static.mjs          # statisk filservering for den pakkede appen
scripts/
  store.mjs           # skjema, bilde-hash, skriv JSON + index
  llm.mjs             # delt LLM-logikk (generate, suggestTopics)
  tts.mjs             # tekst-til-tale via macOS `say`
  env.mjs             # enkel .env-laster
  seed.mjs            # håndlagde eksempelsaker
  generate.mjs        # CLI-generator
  dev.mjs             # kjør backend + vite sammen
  vendor-llama.mjs    # hent den bundlete llama-server-binæren
electron/
  main.mjs            # produksjons-entry: bundlet LLM + in-process backend
  main.dev.mjs         # dev-entry: vindu mot :5173
  llama.mjs            # spawn/overvåk llama-server
  modelManager.mjs      # last ned GGUF-modellen med fremdrift
public/
  articles/           # index.json + én JSON-fil per sak
  images/             # tilfeldige bilder (picsum, loremflickr, vg.no)
src/
  lib/                # typer, ruter, datalasting, backend-klient
  components/          # Header, FrontPage, ArticleView, GeneratePanel …
```
