# ⚠️ SPOILERS — planted spec deviations

**Stop reading unless you have finished Milestone 4 of [ASSIGNMENT.md](./ASSIGNMENT.md).**
The value of the bug hunt is finding these with tests written against the spec.

---

## Deviation 1 — WARN threshold is exclusive instead of inclusive

- **Where:** `src/domain/budgets.js`, `budgetStatus()`.
- **Spec:** WARN when `spent / limit >= 0.8` (spending exactly 80% of the limit **is** a WARN).
- **Implementation:** uses `spentCents / limitCents > WARN_THRESHOLD` — strict `>` — so
  exactly 80% reports `OK`.
- **Reproduce:** spend 1200 against a 1500 budget → API returns `"status": "OK"`, spec says
  `"WARN"`.
- **Where it surfaces:** `GET /users/:id/budgets` and the `budget.status` field of
  `GET /users/:id/reports/monthly`.
- **Fix:** change `>` to `>=`.

## Deviation 2 — the last day of the month is excluded from monthly windows

- **Where:** the interaction between `monthRange()` in `src/domain/reports.js` (returns the
  month's **last day** as `to`) and `sumByCategoryBetween()` in
  `src/repositories/expensesRepo.js` (filters `date >= from AND date < to` — exclusive upper
  bound). Together they drop expenses dated the last day of the month.
- **Spec:** month windows are inclusive of the first **and last** day.
- **Reproduce:** create an expense dated `2026-07-31`; it appears in
  `GET /users/:id/expenses?from=2026-07-01&to=2026-07-31` (that query path is correct — it
  uses `<=`) but is missing from `GET /users/:id/reports/monthly?month=2026-07` and from
  budget `spentCents`.
- **Fix (either):** make `sumByCategoryBetween` use `date <= ?`, or make `monthRange` return
  an exclusive upper bound (first day of the next month) and document it. Pick one and keep
  the pair consistent.

---

If your tests also caught things *not* on this list — validation corner cases, error-envelope
inconsistencies, cache behavior — good. That's the point of testing against a spec.
