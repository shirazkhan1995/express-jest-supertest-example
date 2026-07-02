# Expense Tracker API — Specification

This document is the **source of truth** for the API's intended behavior. Tests should be
written against *this spec*, not against what the implementation happens to do. Where the
implementation and this spec disagree, the implementation is wrong (see
[ASSIGNMENT.md](./ASSIGNMENT.md), Milestone 4).

## Conventions

- All request and response bodies are JSON.
- All monetary amounts are **integer USD cents** (`4250` = $42.50) unless converted for
  display by the reports endpoint.
- All dates are UTC, formatted `YYYY-MM-DD`; months are formatted `YYYY-MM`.
- Errors always have the shape:

  ```json
  { "error": { "code": "SOME_CODE", "message": "human readable", "details": "optional" } }
  ```

  | HTTP | code               | when                                                    |
  |------|--------------------|---------------------------------------------------------|
  | 400  | `VALIDATION_ERROR` | malformed input, bad query params, malformed JSON body   |
  | 401  | `UNAUTHORIZED`     | missing/invalid bearer token                             |
  | 404  | `NOT_FOUND`        | unknown resource id or unknown route                     |
  | 409  | `CONFLICT`         | uniqueness violation (duplicate email)                   |
  | 422  | `IMMUTABLE_FIELD`  | attempt to update a field that cannot be updated         |
  | 502  | `UPSTREAM_ERROR`   | exchange-rate service unreachable/invalid                |
  | 500  | `INTERNAL`         | anything unexpected                                      |

## Authentication

Every route **except `GET /health`** requires `Authorization: Bearer <token>`.
The expected token is the `API_TOKEN` env var (default `dev-token`).
Missing header, wrong scheme, or wrong token → `401 UNAUTHORIZED`.

## Pagination

List endpoints accept `?page` (default 1) and `?pageSize` (default 20, max 100) and respond
with `{ items, page, pageSize, total }`. Invalid values (non-integer, `page < 1`,
`pageSize < 1` or `> 100`) → `400`.

## Endpoints

### `GET /health`
No auth. → `200 { "status": "ok", "uptime": <seconds> }`

### Users

| Route | Behavior |
|---|---|
| `POST /users` | Body `{ name, email }`. `name`: string, ≥ 2 chars after trimming (stored trimmed). `email`: valid email (stored lowercased). → `201` with the user. Duplicate email (case-insensitive) → `409`. Field errors are reported per-field in `details`. |
| `GET /users` | Paginated list, ordered by id ascending. |
| `GET /users/:id` | → `200` user, or `404`. Non-integer/non-positive id → `400`. |
| `DELETE /users/:id` | → `204` empty body, or `404`. Deleting a user cascades: their expenses and budgets are deleted too. |

User shape: `{ id, name, email, createdAt }`.

### Expenses

Valid categories: `food`, `transport`, `housing`, `entertainment`, `health`, `other`.

| Route | Behavior |
|---|---|
| `POST /users/:id/expenses` | Body `{ amountCents, category, description?, date }`. `amountCents`: positive integer ≤ 100,000,000. `category`: one of the list above. `description`: optional string ≤ 200 chars (defaults to `""`). `date`: real calendar date `YYYY-MM-DD` (e.g. `2026-02-30` is invalid). → `201` with the expense. Unknown user → `404`. |
| `GET /users/:id/expenses` | Paginated, newest date first. Optional filters: `category` (must be valid), `from`, `to` (inclusive on both ends, must be valid dates). |
| `PATCH /expenses/:id` | **Only `category` and `description` may be updated.** Any other field in the body → `422 IMMUTABLE_FIELD` listing the offending fields (and nothing is updated). Empty body → `400`. Unknown expense → `404`. → `200` with the updated expense. |
| `DELETE /expenses/:id` | → `204`, or `404`. |

Expense shape: `{ id, userId, amountCents, category, description, date, createdAt }`.

### Budgets

A budget is a monthly spending limit for one category, in USD cents.

| Route | Behavior |
|---|---|
| `PUT /users/:id/budgets/:category` | Body `{ monthlyLimitCents }`: positive integer. Creates or replaces (upsert) → `200 { userId, category, monthlyLimitCents }`. Invalid category → `400`. Unknown user → `404`. |
| `GET /users/:id/budgets` | → `200` array, one entry per budget, ordered by category: `{ category, monthlyLimitCents, month, spentCents, status }` where `month` is the **current UTC month**, `spentCents` is the sum of that category's expenses in the current month, and `status` is computed as below. |

**Budget status rules:**

- `OVER` — spent strictly greater than the limit.
- `WARN` — spent is **at least 80%** of the limit (i.e. `spent / limit >= 0.8`) but not OVER.
  Spending exactly 80% of the limit **is** a WARN.
- `OK` — everything else.

**Monthly windows are inclusive of the entire month**: an expense dated the 1st and an
expense dated the last day of the month (e.g. `2026-07-31` for July) **both count** toward
that month's spend.

### Reports

| Route | Behavior |
|---|---|
| `GET /users/:id/reports/monthly?month=YYYY-MM[&currency=XXX]` | `month` is **required** (`400` if missing/malformed). `currency` defaults to `USD`; must match `^[A-Z]{3}$` → else `400`. Unknown user → `404`. |

Response:

```json
{
  "month": "2026-07",
  "currency": "EUR",
  "totalCents": 91034,
  "categories": [
    { "category": "food", "totalCents": 7222,
      "budget": { "monthlyLimitCents": 7360, "status": "WARN" } },
    { "category": "housing", "totalCents": 82708 }
  ],
  "overBudgetCategories": []
}
```

Rules:

- `categories` contains one entry per category **that has expenses in the month**, ordered by
  category name. Budgeted categories with zero spend are omitted.
- The month window is **inclusive of the first and last day of the month** (same rule as
  budgets above).
- The `budget` sub-object appears only for categories that have a budget. `status` is
  computed from the **USD** amounts using the budget status rules above.
- All `*Cents` amounts in the response are converted to the requested `currency` and rounded
  to the nearest cent (`Math.round` semantics). `totalCents` is the sum of the
  already-converted category totals.
- `overBudgetCategories` lists the categories whose status is `OVER`.

## Exchange rates (external dependency)

Conversion rates come from an external HTTP service (`RATES_URL`, default
`https://open.er-api.com/v6/latest/USD`), which returns
`{ "rates": { "USD": 1, "EUR": 0.92, ... } }` — units of each currency per 1 USD.

Client behavior (`src/clients/ratesClient.js`):

- Responses are **cached in memory** for `RATES_CACHE_TTL_MS` (default 10 min); within the
  TTL no second HTTP call is made.
- Requests time out after `RATES_TIMEOUT_MS` (default 3000 ms).
- Network error, timeout, non-2xx status, or a payload without `rates.USD === 1` →
  `502 UPSTREAM_ERROR` from the report endpoint.
- A `currency` not present in the rates payload → `400 VALIDATION_ERROR`.
- Requests with `currency=USD` (or no `currency`) must **not** call the external service.

## Configuration

| env var | default | purpose |
|---|---|---|
| `PORT` | `4000` | listen port |
| `API_TOKEN` | `dev-token` | bearer token |
| `DB_FILE` | `data/expenses.db` | SQLite file, `:memory:` supported |
| `RATES_URL` | open.er-api.com | exchange-rate service |
| `RATES_TIMEOUT_MS` | `3000` | client timeout |
| `RATES_CACHE_TTL_MS` | `600000` | client cache TTL |
