# Expense Tracker API — a from-scratch testing assignment

A small but **real** Express 5 service: layered architecture, SQLite persistence, an external
HTTP dependency, bearer auth, validation, and centralized error handling.

It ships with **zero tests**. That's the assignment: build the unit, component, and
integration test suite from scratch. Start here:

1. **[docs/API.md](./docs/API.md)** — the behavioral spec your tests must encode.
2. **[docs/ASSIGNMENT.md](./docs/ASSIGNMENT.md)** — milestones, ground rules, and a rubric.
3. **docs/SPOILERS.md** — 🚫 do not open until Milestone 4. The implementation deviates from
   the spec in at least two places; your tests are supposed to find them.

## Quick start

```bash
npm install
npm run db:seed     # demo data in data/expenses.db
npm start           # http://localhost:4000

curl -H "Authorization: Bearer dev-token" localhost:4000/users
curl -H "Authorization: Bearer dev-token" "localhost:4000/users/1/reports/monthly?month=$(date -u +%Y-%m)"
```

## Architecture

```
src/
  index.js            # bootstrap: listen + graceful shutdown
  app.js              # createApp({ db, ratesClient, apiToken, now }) — the DI seam
  config.js           # env-driven configuration
  routes/             # HTTP layer: parse params, delegate, set status
  services/           # use-cases; factories take their dependencies as arguments
  repositories/       # SQL, one module per table (better-sqlite3)
  domain/             # pure logic: money, budgets, reports, validation, errors
  middleware/         # bearer auth, 404 handler, central error handler
  clients/            # ratesClient — external exchange-rate HTTP API (cached, timed out)
  db/                 # connection factory, migrations, seed script
tests/                # empty — yours to fill (jest, supertest, nock preinstalled)
```

Every layer receives its collaborators explicitly (no singletons), so each one can be tested
in isolation and the whole app can be booted against an in-memory database:

```js
const { createApp } = require("./src/app");
const { createDb } = require("./src/db/connection");
const app = createApp({ db: createDb(":memory:"), apiToken: "test-token" });
// hand `app` to supertest — no port, no shared state
```

`npm test` currently runs jest with `--passWithNoTests` so CI is green on day one; removing
that flag is part of the final milestone.
