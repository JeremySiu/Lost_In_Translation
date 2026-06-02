# Lost in Translation

A music guessing game where song lyrics are deliberately mangled through a chain of unusual languages and back to English. Players listen to a short audio preview, then read the garbled lyrics and try to identify the song before the hints run out.

## How It Works

Each round presents 5 songs. For every song:

1. A short clip from the iTunes preview plays.
2. Lyrics are revealed one line at a time, each line read aloud via TTS.
3. The lyrics have been "mangled" by Gemini 2.5 Flash, which simulates translating them through a random chain of obscure languages (e.g. English → Mongolian → Basque → Finnish → English).
4. Players type their guess. Fuzzy matching via Fuse.js catches close answers.
5. Hints reveal additional lines at a 100-point cost each.

**Adaptive difficulty** adjusts automatically between rounds based on score, guess speed, hints used, and wrong guesses. A struggling player gets a shorter language chain and a longer audio clip; a top performer gets a 6-language chain and a 1-second clip.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| UI | React 18, Tailwind CSS, Framer Motion |
| AI mangling | Google Gemini 2.5 Flash via `@langchain/google-genai` |
| TTS | Gradium (`gradium.ai`) |
| Lyrics | Genius API |
| Charts | Last.fm chart API |
| Audio previews | iTunes Search API |
| Leaderboard | Supabase |
| Observability | LangSmith (LangChain tracing) |

## Project Structure

```
app/
  page.jsx                        # Entry point — mounts App client-side
  api/
    songs/round/route.js          # GET  — pick 5 songs for the round
    songs/[id]/reveal/route.js    # GET  — return hook_lines after song resolves
    mangle/route.js               # POST — mangle lyrics with Gemini + adaptive params
    tts/route.js                  # POST — text-to-speech via Gradium
    leaderboard/route.js          # GET/POST — top-10 scores in Supabase
    cron/refresh-corpus/route.js  # GET  — rebuild corpus from Last.fm + Genius + iTunes

src/
  components/                     # React UI components
  hooks/
    useGameState.js               # Central game state reducer
    useAudio.js                   # Audio playback hook
  lib/
    adaptive.js                   # Difficulty logic, prompt builder, language picker
    corpus.js                     # Round selection (1 trending + 4 random, no repeats)
  data/
    corpus.json                   # Pre-built song corpus (committed; refreshed by cron)
```

## Corpus Pipeline

The corpus is built by chaining four steps, all consolidated in `app/api/cron/refresh-corpus/route.js`:

1. **Fetch top 100** — Pull chart data from Last.fm, match each track against iTunes Search to get a verified 30-second preview URL.
2. **Fetch lyrics** — Search Genius for each matched track, extract the chorus (or first section if no chorus label is found), and keep the top 4 lines as `hook_lines`.
3. **Merge corpus** — Diff new songs against the existing `corpus.json`. Existing songs are marked `trending: false`; new arrivals are appended; returning chart songs have `trending` flipped back to `true` and their preview URL updated.
4. **Enrich album art** — Fill any missing `album_art_url` fields via an iTunes artwork lookup.

The final `corpus.json` is written to `src/data/corpus.json` and optionally triggers a Vercel redeploy via `VERCEL_DEPLOY_HOOK_URL`.

**To run the pipeline manually**, hit the cron endpoint:
```
GET /api/cron/refresh-corpus
```

## API Reference

### `GET /api/songs/round?seen=id1,id2`
Returns 5 song objects (without `hook_lines`). Pass previously seen IDs to avoid repeats. Guarantees at least 1 trending song when available.

### `GET /api/songs/:id/reveal`
Returns the full song data including `hook_lines`, used after the player resolves the song.

### `POST /api/mangle`
```json
{
  "songs": [{ "id": "song-slug" }],
  "performanceHistory": [{ "score": 400, "timeToGuessSeconds": 12, "hintsUsed": 0, "wrongGuesses": 1 }],
  "roundNumber": 2
}
```
Returns `{ difficulty, clip_duration_ms, songs: [{ id, mangled_lines, language_chain }] }`.

Set `MOCK_MANGLE=true` to skip the Gemini call and return deterministic fake output — useful for local development without an API key.

### `POST /api/tts`
```json
{ "text": "mangled lyric line" }
```
Returns `audio/wav` binary. Responses are not cached server-side; the client maintains a per-session blob URL cache.

### `GET /api/leaderboard`
Returns the top 10 scores: `[{ initials, score, date }]`.

### `POST /api/leaderboard`
```json
{ "initials": "ABC", "score": 2400 }
```
Initials are sanitised to 3 uppercase letters. Max accepted score is 5000.

## Getting Started

### Prerequisites
- Node.js 18+
- API keys for: Google Gemini, Gradium, Genius, Last.fm
- A Supabase project with a `Leaderboard` table (`initials text, score int, created_at timestamptz`)

### Installation

```bash
git clone https://github.com/your-org/lost-in-translation.git
cd lost-in-translation
npm install
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in your keys:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API key |
| `GRADIUM_API_KEY` | Gradium API key |
| `GRADIUM_VOICE_ID` | Voice ID to use for TTS |
| `GENIUS_ACCESS_TOKEN` | Genius API client access token |
| `LASTFM_API_KEY` | Last.fm API key |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `LANGCHAIN_TRACING_V2` | Set to `true` to enable LangSmith tracing |
| `LANGCHAIN_API_KEY` | LangSmith API key |
| `LANGCHAIN_PROJECT` | LangSmith project name |
| `MOCK_MANGLE` | Set to `true` to skip Gemini calls during development |
| `VERCEL_DEPLOY_HOOK_URL` | (Optional) Trigger a redeploy after corpus refresh |

### Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The game requires a populated `src/data/corpus.json`. A sample corpus is committed to the repo. To refresh it with live data, call `/api/cron/refresh-corpus` once the server is running.

### Building for Production

```bash
npm run build
npm start
```

## Scoring

| Event | Points |
|---|---|
| Correct guess | 100 – 500 (based on hints used) |
| Streak multiplier | Up to 2× (increases by 0.2 per consecutive correct) |
| Hint cost | −100 per hint revealed |
| Give up | 0 pts, streak resets |

Maximum possible score per 5-song round: **5000 points**.
