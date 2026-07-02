# The Assignment: Test This Service From Scratch

This repository contains a **working, untested** Expense Tracker API. Your job is to build
its entire test suite — unit, component, and integration — from nothing. The spec in
[API.md](./API.md) is your source of truth. The tooling (`jest`, `supertest`, `nock`) is
already installed; `tests/` is empty on purpose.

⚠️ **Do not open `docs/SPOILERS.md`** until you finish Milestone 4. The implementation
deviates from the spec in at least **two** places, and finding them with tests is part of
the assignment.

## Definitions used here

- **Unit test** — one function/module in isolation. All collaborators are replaced with
  stubs/mocks/fakes. No HTTP, no database, no network. Milliseconds fast.
- **Component test** — the whole service exercised **through its public HTTP API** (via
  supertest, no real port needed), with infrastructure that is *fast and local* (in-memory
  SQLite) and **third-party network calls mocked at the HTTP boundary** (nock). This is the
  backbone of the suite — most confidence per line of test code.
- **Integration test** — verifies real boundaries actually work: a real SQLite file on disk
  surviving reconnection, a real server bound to a real port, the rates client talking to a
  real (locally spun-up) HTTP server, timeouts firing for real.

Rule of thumb for this codebase: lots of component tests, focused unit tests where logic
branches (domain/, middleware/, client), a handful of integration tests for the seams.

## Ground rules

1. **Don't modify `src/`** until Milestone 4 — and then only to fix the spec deviations your
   tests caught.
2. **No test may hit the real internet.** Call `nock.disableNetConnect()` (allow
   `127.0.0.1` for supertest/local servers with `nock.enableNetConnect(/127\.0\.0\.1|localhost/)`).
3. **Tests must be independent and repeatable**: any test file runnable alone
   (`npx jest tests/unit/money.test.js`), whole suite green when run twice in a row, and no
   test depending on execution order. Fresh DB per test file (or per test) — `createDb(":memory:")`
   is your friend, passed into `createApp({ db })`.
4. **Assert on behavior, not implementation**: prefer status codes, response bodies, and
   observable state over "function X was called".
5. Suggested layout:

   ```
   tests/
     unit/         # domain, middleware, client, services-with-stubbed-repos
     component/    # supertest against createApp() with :memory: db + nock
     integration/  # real files, real ports, real local HTTP servers
     helpers/      # app/db factories, auth header helper, fixture builders
   ```

## Milestone 0 — Recon (no tests yet)

- Run the app: `npm install && npm run db:seed && npm start`, then hit endpoints with curl
  (`Authorization: Bearer dev-token`).
- Sketch the dependency graph: routes → services → repositories → db, services → domain,
  reportsService → ratesClient → external HTTP. Identify every seam where a test can inject
  a double (`createApp(...)` and each `create*Service(...)` factory take their dependencies
  as arguments — that's deliberate).

## Milestone 1 — Unit tests

Cover at minimum, with all collaborators stubbed:

- `domain/money.js` — identity conversion, normal conversion, rounding at the half-cent,
  unknown/zero/negative/non-finite rate, non-integer input.
- `domain/budgets.js` — OK/WARN/OVER transitions **at the exact boundaries the spec defines**,
  invalid inputs.
- `domain/reports.js` — `monthRange` for 31-day, 30-day, February, and leap-February months;
  `buildMonthlyReport` with and without budgets, currency conversion, over-budget listing.
- `domain/validate.js` — each validator: happy path, each rejection branch, trimming and
  lowercasing behavior, pagination defaults/caps, `2026-02-30`-style impossible dates.
- `middleware/auth.js` — no header, wrong scheme, wrong token, correct token (use fake
  `req`/`res`/`next` objects — no HTTP needed).
- `middleware/errors.js` — an `AppError` maps to its status/code/details; an unknown error
  maps to 500 without leaking its message; malformed-JSON errors map to 400.
- `clients/ratesClient.js` — inject a fake `fetchFn`: success caches (second call within TTL
  performs no fetch), cache expiry refetches, non-ok status, rejected fetch, bad payload
  (missing `rates`, `rates.USD !== 1`).
- One service with hand-stubbed repos, e.g. `usersService`: duplicate email → `ConflictError`,
  unknown id → `NotFoundError` — proving services are unit-testable without a DB.

**Done when:** `npx jest tests/unit` is green and runs in well under a second.

## Milestone 2 — Component tests

Boot the app per test file with `createApp({ db: createDb(":memory:"), apiToken: "test-token" })`
and drive it with supertest. Cover at minimum:

- **Auth:** 401 on missing/wrong token for a protected route; `/health` open.
- **Users:** create → fetch → list round-trip; email lowercased and name trimmed in the
  stored result; 400 with per-field `details`; 409 duplicate (including different case);
  404s; 400 non-integer id; delete → 204 → subsequent fetch 404; **cascade** — deleting a
  user removes their expenses (verify via the DB handle or a second user's isolation).
- **Expenses:** create → list round-trip; every validation rejection; filters (`category`,
  `from`/`to` inclusivity on both ends); pagination (`total` vs `items.length`, page 2
  contents, `pageSize` cap); PATCH happy path; PATCH `amountCents` → 422 with field list and
  **no partial update applied**; PATCH empty body → 400; malformed JSON body → 400.
- **Budgets:** upsert semantics (PUT twice → one row, new limit); status listing with a
  seeded month of expenses (inject `now` into `createApp` to pin "current month").
- **Reports (nock the rates URL):** USD report requires no HTTP call (assert nock saw no
  requests); `currency=EUR` converts every amount and the total; rates service 500 / network
  error / garbage payload → 502; unknown currency in a valid payload → 400; rate response is
  cached (two report calls, one upstream hit — use `RATES_CACHE_TTL_MS`-style injection via
  `new RatesClient({...})` passed into `createApp`).
- **Unknown route** → 404 envelope.

**Done when:** every row in the API.md tables has at least one component test, including its
error rows.

## Milestone 3 — Integration tests

- **Real DB file:** point `createDb` at a temp file (e.g. in `os.tmpdir()`); write via one
  connection, close it, reopen, and verify the data survived; verify `migrate` is idempotent
  (booting twice doesn't fail or duplicate).
- **Real server:** start `createApp(...)` with `app.listen(0)`, hit it over
  `http://127.0.0.1:<port>` with `fetch`, assert a full happy-path flow
  (create user → expense → budget → report), then close cleanly.
- **Real rates HTTP:** spin up a local `http.createServer` stub of the rates API; run a
  report with `RatesClient` pointed at it; then make the stub *hang* longer than a short
  `timeoutMs` and assert the 502 timeout path fires for real.

**Done when:** the suite still passes with the network unplugged, twice in a row, and leaves
no stray files, ports, or open handles (`jest --detectOpenHandles` is clean).

## Milestone 4 — The bug hunt

The implementation deviates from API.md in **at least two places**. They are boundary bugs —
the kind code review misses.

1. Write a **failing** test per deviation that encodes the *spec's* behavior (read the
   budget-status rules and the month-window rules very carefully).
2. Fix `src/` minimally so your tests pass.
3. Only now read `docs/SPOILERS.md` and check you found them all.

**Done when:** the previously failing tests are green and the whole suite still passes.

## Milestone 5 — Harden (bonus)

- Remove `--passWithNoTests` from the `test` scripts (it was only there so CI passed before
  you started).
- Enable the commented-out `coverageThreshold` in `jest.config.js` and make
  `npm run test:coverage` pass it; raise the numbers until raising them further would force
  low-value tests.
- Push and confirm the GitHub Actions workflow runs your suite.
- Stretch: add [Stryker](https://stryker-mutator.io/) mutation testing to `src/domain/` and
  drive mutation score up — the honest measure of whether your assertions actually assert.

## Self-grading rubric

| Question | Yes? |
|---|---|
| Can you run any single test file alone and green? | |
| Does the suite pass with WiFi off? | |
| Did unit tests catch the domain-level deviation and component tests the HTTP-level one? | |
| Does any test break if a function is renamed without behavior changing? (It shouldn't.) | |
| Suite twice in a row: both green? | |
| Unit suite < 1s, whole suite < 10s? | |
