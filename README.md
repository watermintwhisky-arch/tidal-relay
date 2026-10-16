# Tidal Relay

Play: https://kiki-tidal-relay.sappyrain128.chatgpt.site

Repository: https://github.com/watermintwhisky-arch/tidal-relay

A short strategy game for 2–4 human or HTTP-controlled players. Create a lobby, share its eight-character code, and start when ready; empty seats become bots. No login is required.

## Rules

Each player takes one action per round on a shared 5×5 sea: sail one orthogonal tile, dash to a tile at Manhattan distance two for one cargo pearl, salvage up to two pearls, bank at a beacon, raid one cargo pearl from a rival on the same or an adjacent tile, or wait. Cargo is capped at six. Banking at your home port with at least three cargo adds one bonus pearl. The announced striped row or column floods after everyone acts, removing up to two unbanked pearls from anyone there. Small pearl deposits replenish between rounds. After eight rounds, banked pearls plus half remaining cargo (rounded down) determines the winner; ties share victory. A missed 12-second turn is played by a bot. With four humans, the turn clock totals at most 6 minutes 24 seconds; lobby and network time are additional.

The board starts rotationally symmetric. Choosing a nearby deposit, a safer route, a rival to raid, a costly dash, or an early bank changes risk and tempo. This is a prototype; balance has not been proven mathematically.

## Run locally

Use Node 22.13+ and the checked-in npm lockfile. Run `npm run install:ci`, `npm run build`, then apply the generated migration to the local D1 database before `npm start`:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_dizzy_blockbuster.sql
```

The default production preview is on `http://127.0.0.1:8787`. Storage binding `DB` is declared in `.openai/hosting.json`. Migrations are applied during deployment, never inside a request handler. Run engine checks with `node --test tests/game.test.mjs`; typecheck with `node node_modules/typescript/bin/tsc --noEmit`.

## HTTP API

All bodies are JSON. Tile indexes are row-major, 0–24. Read responses include `code`, `revision`, `game`, `legalActions`, `standings`, server `now`, and `rules`. `game.active` is the current player ID, `game.dueAt` is its Unix millisecond deadline. Each action and replay frame is retained in `game.log` and `game.history`.

| Method | Path | Request body |
| --- | --- | --- |
| POST | `/api/matches` | `{"name":"Captain","seats":2}` |
| POST | `/api/matches/CODE/join` | `{"name":"Agent"}` |
| POST | `/api/matches/CODE/start` | `{"token":"HOST_TOKEN"}` |
| GET | `/api/matches/CODE` | None |
| POST | `/api/matches/CODE/move` | `{"token":"PLAYER_TOKEN","revision":3,"action":{"type":"sail","to":7}}` |

Create/join return a secret `token` and a zero-based `playerId`. Save them privately: state responses never return other players' tokens or their hashes. Only the host can start. A player can act only for its own current seat. Choose an object from `legalActions`: `sail`/`dash` use `to`; `raid` uses `target`; `harvest`, `bank`, and `wait` have no extra fields. Refresh state after HTTP 409 before retrying a move. POSTs are not idempotent; never blindly retry create/join. Concurrent writes use a database revision comparison, so a stale action cannot overwrite an accepted move.

GET resolves due bot/timeout turns lazily. A lone inactive match does not consume a background timer; it catches up when read, and each resumed human gets a fresh deadline. Matches expire after seven days. Codes permit viewing a match; they are not private-chat channels. Player credentials are bearer secrets stored in the browser's local storage; do not share them. Names are plain text and should contain no sensitive information.

## Sample bot

The standard-library Python client is served at `/sample-bot.py`:

```sh
python public/sample-bot.py http://127.0.0.1:8787
python public/sample-bot.py http://127.0.0.1:8787 ABCD1234
```

Without a code it creates and starts against a built-in bot. With a code it joins a lobby and waits for the host. It reads legal actions, controls only its own seat, and refreshes on a revision conflict.

## Contest pitch

Tidal Relay is an eight-round sea heist where every move weighs a tempting pearl haul against a publicly forecast tide. Friends join by code, empty seats become bots, and external agents play through the same JSON API, with a full move-by-move replay and a runnable Python client.

## Source attribution

Game rules, engine, room API, interface and sample bot are in `lib/game.mjs`, `lib/rooms.ts`, `app/page.tsx`, `app/globals.css`, and `public/sample-bot.py`. Hosting/build integration and reusable UI scaffolding derive from the OpenAI Sites Vinext starter; retained dependency and vendor licenses apply to those components. This repository contains no wallet keys or runtime credentials. Its Sites project ID identifies the hosted instance; fork deployers should register their own Site and replace that ID before publishing.
