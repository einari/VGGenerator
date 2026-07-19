# Package VG Generator as a self-contained macOS app (Electron, embedded LLM, no Docker)

## Goal

Ship VG Generator as a double-clickable macOS app that runs entirely offline/local — no
oMLX app, no Docker, no manual `.env` setup. The LLM runs *inside* the app package. Local
dev via `yarn dev` must keep working exactly as it does today; Electron is purely an
additional packaging layer on top, not a replacement for the dev workflow.

Speech ("Hør saken") should ideally come along for the ride too, but it's a nice-to-have —
ship without it if it adds too much risk/time.

## Current architecture (for context)

- **Frontend**: React + Vite (`yarn dev` → `:5173`, proxies `/api` to the backend).
- **Backend**: zero-dependency Node server (`server/index.mjs`, `:8787`) that calls
  `LLM_BASE_URL` (an OpenAI-compatible endpoint, currently oMLX at `127.0.0.1:8000/v1`)
  from `scripts/llm.mjs`.
- **TTS**: Piper via Docker (`docker-compose.yml`), reached over the Wyoming protocol
  (TCP `:10200`) from `scripts/tts.mjs`.

Nothing here is hard-wired to oMLX or Docker specifically — both are just "a local
server on localhost." That's what makes embedding feasible.

## Proposed approach

### 1. Bundled LLM (replaces oMLX)

- Bundle `llama.cpp`'s `llama-server` binary (prebuilt macOS arm64, Metal-accelerated,
  single native binary, no Python runtime needed).
- Ship a quantized GGUF chat model (pick something in the Gemma/Llama/Qwen 3–4B class,
  Q4_K_M or similar — roughly 2–3GB).
- **Do not bake the model into the `.app` bundle.** Download it on first run into
  `~/Library/Application Support/VGGenerator/models/` with a progress screen. Keeps the
  installer small and updates sane.
- Point `LLM_BASE_URL` at the bundled server (`127.0.0.1:<port>/v1`). It already speaks
  `/v1/chat/completions` and `/v1/models`, so `scripts/llm.mjs` should need little to no
  change — drop the `LLM_API_KEY` requirement for the embedded case.
- Apple Silicon only, realistically — Intel/CPU inference would be too slow to be fun.
  App should detect this and say so clearly rather than silently being unusably slow.

### 2. Electron shell

- Electron's main process is Node — run `server/index.mjs`'s logic in-process rather
  than spawning it as a separate child process.
- Main process responsibilities on launch:
  - Check/download the model file if missing (first-run only).
  - Spawn the bundled `llama-server` process.
  - Start the backend in-process on its usual port.
  - Serve the built frontend (`yarn build` output) off the same port so production
    doesn't need Vite's dev proxy.
  - Open a `BrowserWindow` pointed at that URL.
- Add a small static-file serving path to the backend (or a thin wrapper) for the
  production case, since `server/index.mjs` currently only serves `/api/*`.

### 3. Keep `yarn dev` working unchanged

- Add a separate `electron:dev` entry point that does nothing but open a
  `BrowserWindow` pointed at `http://localhost:5173`, assuming `yarn dev` is already
  running in a terminal like today.
- The existing hot-reload dev loop must not be touched by any of this work.

### 4. Speech (optional / stretch)

- Piper has a standalone native CLI (no Docker, no Wyoming server needed): pipe text to
  stdin, get WAV back. Rewrite `scripts/tts.mjs`'s Wyoming socket client into a
  child-process call to a bundled `piper` binary + Norwegian voice model, keeping the
  same external interface (`buildSegments` → synthesize → stream WAV).
- Cheaper fallback if Piper native integration is too much scope: shell out to macOS's
  built-in `say` with a Norwegian voice. Zero bundling, noticeably lower quality than
  Piper's dedicated Norwegian voice, but works out of the box.

## Scope / tasks

- [ ] Vendor/download a prebuilt `llama-server` macOS arm64 binary into the build.
- [ ] Pick and host a default GGUF model for first-run download; implement the
      download + progress UI.
- [ ] Electron project scaffold (main process, preload if needed, `electron-builder`
      config for mac target — dmg/zip, arm64).
- [ ] Wire main process to run the backend in-process and serve the frontend build.
- [ ] Adjust `scripts/llm.mjs` / env handling for the no-API-key local case.
- [ ] `electron:dev` script that opens a window against `:5173` — verify `yarn dev`
      is fully unaffected.
- [ ] (Stretch) Native Piper CLI integration replacing the Wyoming/Docker path.
- [ ] (Stretch fallback) `say`-based TTS if native Piper is deprioritized.
- [ ] Code signing + notarization, including the bundled `llama-server`/`piper`
      binaries (Gatekeeper will block unsigned spawned binaries on other people's Macs).
- [ ] Basic first-run smoke test on a clean machine (no oMLX, no Docker installed).

## Out of scope

- Windows/Linux packaging.
- Intel Mac performance tuning (CPU-only inference is expected to be slow; just detect
  and message it).
- Auto-updater.

## Risks / open questions

- App size: a few hundred MB for the app itself, plus the downloaded model. Confirm
  this is acceptable for distribution.
- Model licensing for redistribution/download — confirm terms for whichever model is
  chosen as the default.
- Notarization of bundled native binaries is the most likely source of last-mile pain —
  worth spiking early rather than leaving it to the end.
