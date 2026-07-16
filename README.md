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

## Les opp saker (text-to-speech)

Hver artikkel har en høyttaler-knapp **«Hør saken»** rett under bylinen. Den leser
overskrift, ingress og hele brødteksten på norsk – med små pauser mellom – via
[Piper](https://github.com/rhasspy/piper). Backend snakkar Wyoming-protokollen mot
Piper-containeren og **strømmer** WAV-en videre til nettleseren.

```bash
docker compose up -d piper     # første gang lastes den norske stemma ned
docker compose logs -f piper   # følg med
docker compose down            # stopp
```

Stemma er `no_NO-talesyntese-medium` (den norske Piper-stemma). Vil du bytte,
endrar du `--voice` i [docker-compose.yml](docker-compose.yml) **og** `TTS_VOICE`
i `.env` slik at dei stemmer. Andre stemmer: <https://huggingface.co/rhasspy/piper-voices>
(mappa `no/`). Slå av med `TTS_ENABLED=false`. Config (host/port/voice) ligg i
`.env`, som med LLM-en.

> Merk: backend må startast på nytt (`yarn dev`) etter at containeren er oppe,
> og Piper si norske stemme-utvalet er avgrensa – «kvinnelig nyhetsoppleser»
> avheng av kva stemmer som finst.

## Kommandoer

| Kommando        | Hva                                                    |
| --------------- | ------------------------------------------------------ |
| `yarn dev`      | Backend + Vite (med `/api`-proxy) samtidig             |
| `yarn dev:web`  | Bare Vite                                              |
| `yarn server`   | Bare backend                                           |
| `docker compose up -d piper` | Start norsk TTS-stemme (Piper)            |
| `yarn build`    | Typecheck + produksjonsbygg                            |
| `yarn preview`  | Server produksjonsbygget                               |
| `yarn seed`     | Skriv håndlagde eksempelsaker til `public/articles/`   |
| `yarn generate` | Generer saker med lokal LLM → JSON-filer               |
| `yarn lint`     | Oxlint                                                 |

## Prosjektstruktur

```text
prompts/
  system-prompt.md    # redaksjonell stil (delt kilde)
  sections.json       # seksjoner + forfatternavn
server/
  index.mjs           # /api/generate, /api/topics, /api/health
scripts/
  store.mjs           # skjema, bilde-hash, skriv JSON + index
  llm.mjs             # delt LLM-logikk (generate, suggestTopics)
  env.mjs             # enkel .env-laster
  seed.mjs            # håndlagde eksempelsaker
  generate.mjs        # CLI-generator
  dev.mjs             # kjør backend + vite sammen
public/
  articles/           # index.json + én JSON-fil per sak
  images/             # tilfeldige bilder (picsum, loremflickr, vg.no)
src/
  lib/                # typer, ruter, datalasting, backend-klient
  components/          # Header, FrontPage, ArticleView, GeneratePanel …
```
