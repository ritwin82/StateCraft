# Statecraft · Intelligent DFA/NFA Tutor

A complete local-first automata learning workspace: graphical DFA/NFA/ε-NFA editing,
step-by-step simulation, shortest counterexamples, bounded repair diagnosis, progressive
hints, adaptive practice, debug challenges, and student/instructor progress.

**Correctness comes only from the TypeScript engine.** The installed Ollama model
`gemma3:4b` phrases verified facts; it never grades answers.

![Desktop workspace](artifacts/desktop.png)

## Start locally

Requires Node.js 22+ (tested with 24), pnpm 11, and optionally Ollama and PostgreSQL.

```sh
pnpm install
pnpm db:generate
pnpm dev
```

Open http://127.0.0.1:5173. Vite proxies `/api` to port 3001.
The starter challenge works without registration, a database, or an LLM.
Local practice history stays in browser storage. The canvas survives navigation within
the app; export JSON to retain it across browser reloads.

Copy `.env.example` to `.env` to customize settings. Without `DATABASE_URL`, the API
uses **temporary memory**: accounts and account progress disappear on API restart.

### Ollama

Start Ollama and ensure `ollama list` contains `gemma3:4b`. It was found and successfully
tested on this machine. Set `OLLAMA_MODEL` to switch models (also installed here:
`gemma3:12b` and `qwen2.5-coder:3b`). The API defaults to `http://127.0.0.1:11434`.

Create an account to use API-backed questions and Ollama hints. All challenge entry
points, including reloads and Debug mode, use the authenticated question loader.
Slow/offline models and rejected output fall back to verified templates. No cloud LLM
credentials are required. Ollama calls time out after 30 seconds.

### PostgreSQL persistence

Use an existing database or set these values in `.env` and use Docker Compose.
Choose your own password and random JWT secret; never commit `.env`.

```dotenv
POSTGRES_PASSWORD=your-local-database-password
DATABASE_URL=postgresql://tutor:your-local-database-password@localhost:5432/tutor?schema=public
JWT_SECRET=your-random-secret-of-at-least-32-characters
```

```sh
docker compose up -d
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

Prisma models cover users, questions, attempts, misconceptions, mastery, and hint usage.
Seeding upserts 120 verified questions (15 per topic: 5 easy, 5 medium, 5 hard); the same data is included in `data/questions.json`.
`db:push` is for development; use reviewed Prisma migrations for deployed databases.

Register an instructor with the correct class code, then explicitly grant the role:

```sh
pnpm --filter @tutor/api instructor instructor@example.com
```

Sign in again to reveal **My class**. Registration cannot assign instructor privileges.
Reports include only users sharing the instructor's class code. Class codes are
self-selected, not a managed institutional enrollment system.

## Checks

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm evaluate
pnpm evaluate --live
# With pnpm dev running, Edge installed, and Ollama available:
node scripts/browser-check.mjs
```

The browser check uses an isolated headless Edge session and creates disposable test
accounts in the running API. It checks machine repair, simulation, preserved navigation,
debug/hints, mobile editing, registration, authenticated reload, live Ollama, and scoring.
Screenshots and JSON evaluation reports are saved under `artifacts`.

Measured during implementation:

- 550 random DFA pairs agree with an independent exhaustive oracle through length 10.
  Tests limit DFAs to three states; the product has at most nine states, so every possible
  shortest counterexample is within the enumeration bound.
- Evaluation recovered valid repairs for 100/100 seeded mutation cases, recording exact
  original restoration separately because alternate equivalent repairs can be correct.
- 100/100 live Ollama hint requests returned accepted model responses with zero detected
  leaks. This measures the tested cases, not a proof about arbitrary model prose.
- Desktop and 390px mobile flows passed without page errors or horizontal overflow.
- Prisma client generation succeeded. PostgreSQL-backed execution was **not exercised**:
  the installed Docker engine returned an internal server error. API tests use the same
  storage interface with memory storage.

## Architecture

```text
React / React Flow / Zustand / Tailwind
        ├── Web Worker → pure TypeScript engine
        │                 validation · traces · conversion · minimization
        │                 equivalence · diagnosis · questions · mastery
        └── Express API → the same deterministic engine
                 ├── level-limited facts → Ollama → leak filter / template fallback
                 └── Prisma → PostgreSQL (temporary memory when unconfigured)
```

```text
packages/engine/src/   Pure algorithms and shared types; zero runtime dependencies
packages/engine/test/  Unit, randomized, language-oracle, and repair tests
apps/web/src/         Studio, tutor, simulator, progress, account, guide, worker
apps/api/src/         Authenticated API, storage abstraction, Ollama hints
apps/api/prisma/      Schema, seed, explicit instructor provisioning
apps/api/test/        HTTP integration and hint-policy tests
scripts/              Evaluation and browser checks
data/                 120 reproducible reference questions
artifacts/            Screenshots and measured reports
```

## Design and algorithm decisions

- Symbols are single Unicode code points; ε is reserved for ENFA transitions. Unknown
  input symbols throw. Empty input and empty alphabets are supported.
- State identifiers are arbitrary nonempty strings. Duplicate declarations/transitions
  are validation errors. Algorithms never mutate caller-owned automata.
- Partial DFAs are valid. Missing transitions reject; completion adds a collision-free
  nonfinal sink. ENFA traces include initial and post-consumption full ε-closures.
- Subset construction uses stable breadth-first discovery and opaque IDs. Minimization
  completes, removes unreachable states, and records table-filling partition rounds.
- Equivalence completes both machines over their union alphabet and uses sorted-symbol
  BFS on the product, giving the shortest lexicographically first witness.
- Diagnosis tries all one-edit candidates before two-edit candidates within six student
  states and a deadline. `null` means no repair established within the bound. Adding a
  state is one atomic edit; its transitions require additional edits. Semantic labels use
  structural/language evidence and do not claim to know a learner's intent.
- Question generation chooses the closest available difficulty among 16 seeded candidates.
  The checked-in bank has 120 distinct prompts and no equivalent duplicate languages within
  a topic. Each of the eight topics has five easy, five medium, and five hard questions.
  Easy corresponds to score 2, medium to 3, and hard to 4–5. Complexity is based on minimal
  DFA size (up to 4 / 7 / 12 / 16 states), with adjustments for larger alphabets and NFA
  savings on larger machines. Patterns reach eight symbols and counting moduli reach nine.
  References stay within the editor's 16-state limit. Versioned IDs preserve older stored
  questions; rerunning the database seed adds the new bank without deleting past attempts.
  Difficulty uses minimal DFA size, alphabet size, and constructive NFA upper bounds; it
  does not claim to compute the minimum NFA. Seed data covers all eight topics.
- Browser verification runs in a disposable worker with a five-second limit. API inputs
  are bounded to 16 DFA states or eight NFA states, four symbols, and 128 transitions.
- Elo starts at 900, K=48, with question strength `difficulty × 300`. Correct score is
  `max(0.2, 1 − 0.15 × highestHintLevel)`; incorrect score is zero. Repeated solves of the
  same question do not repeatedly inflate mastery.
- Hint cache keys include question, misconception, level, and a hash of visible facts.
  Levels 1–3 omit future-level facts and the reference from prompts. Level 4/5 output
  includes canonical engine details so repairs and solutions remain complete. Leak
  filtering is conservative and heuristic; templates are always available.
- Browser references/seeds are inspectable to support local verification. This is a
  learning platform, not a secure exam system. The API independently verifies attempts.
- Passwords use salted scrypt, JWTs use HS256, Zod validates requests, and API/auth rate
  limits are enabled. Production requires a stable JWT secret. The API binds to loopback;
  deployment requires HTTPS and a same-origin reverse proxy for frontend and API.
- Runtime development uses workspace TypeScript sources through Vite/tsx. The engine also
  builds standalone JavaScript/declarations in `packages/engine/dist`.

## Demo

1. Check the starter DFA for strings ending in `ab`; trace its shortest counterexample.
2. Add **q2**, symbol **a**, to **q1**. Check again.
3. Run `aab`, then play or step. The final accepting state lights up.
4. Try NFA branches/ε-edges and animate **Convert to DFA**.
5. Visit **My progress**, then return without losing the machine.
6. Try **Debug the machine**: prove failure with a witness, then repair it.
7. Register/sign in for saved challenges and Ollama hints; reveal levels gradually.
8. With PostgreSQL and an instructor role, review **My class**.

The user-selected warm light visual system is recorded in `DESIGN.md`. Fonts are
self-hosted. Reduced motion, visible focus, and form-based graph editing are included.
