const request = require("supertest");
const { createApp } = require("../../src/app");
const { createDb } = require("../../src/db/connection");

const AUTH = "Bearer test-token";

let app;
let db;
let userId;

// "Current month" for budget status comes from `now`, which createApp lets us
// inject. Pin it to mid-July 2026 so the status listing is deterministic and
// our July expenses land in the current-month window.
beforeEach(async () => {
  db = createDb(":memory:");
  app = createApp({
    db,
    apiToken: "test-token",
    now: () => new Date("2026-07-15T12:00:00Z"),
  });
  const user = await request(app)
    .post("/users")
    .set("Authorization", AUTH)
    .send({ name: "Ada", email: "ada@example.com" });
  userId = user.body.id;
});

afterEach(() => {
  db.close();
});

function setBudget(category, monthlyLimitCents) {
  return request(app)
    .put(`/users/${userId}/budgets/${category}`)
    .set("Authorization", AUTH)
    .send({ monthlyLimitCents });
}

function addExpense(amountCents, category, date) {
  return request(app)
    .post(`/users/${userId}/expenses`)
    .set("Authorization", AUTH)
    .send({ amountCents, category, date });
}

function listBudgets() {
  return request(app).get(`/users/${userId}/budgets`).set("Authorization", AUTH);
}

describe("Budgets (component)", () => {
  describe("PUT /users/:id/budgets/:category", () => {
    test("creates a budget and returns 200 with the shape", async () => {
      const res = await setBudget("food", 10000);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ userId, category: "food", monthlyLimitCents: 10000 });
    });

    test("upserts: PUT twice keeps one row with the latest limit", async () => {
      await setBudget("food", 10000);
      await setBudget("food", 25000);

      const res = await listBudgets();
      const foodBudgets = res.body.filter((b) => b.category === "food");
      expect(foodBudgets).toHaveLength(1);
      expect(foodBudgets[0].monthlyLimitCents).toBe(25000);
    });

    test("rejects an invalid category with 400", async () => {
      const res = await setBudget("candy", 10000);
      expect(res.status).toBe(400);
    });

    test("rejects a non-positive limit with 400", async () => {
      const res = await setBudget("food", 0);
      expect(res.status).toBe(400);
    });

    test("returns 404 for an unknown user", async () => {
      const res = await request(app)
        .put("/users/9999/budgets/food")
        .set("Authorization", AUTH)
        .send({ monthlyLimitCents: 10000 });
      expect(res.status).toBe(404);
    });
  });

  describe("GET /users/:id/budgets", () => {
    test("computes spentCents and status per category for the current month", async () => {
      await setBudget("food", 10000);
      await setBudget("transport", 10000);
      await setBudget("housing", 10000);

      // All dated in the pinned current month (mid-month).
      await addExpense(9000, "food", "2026-07-10"); // 90% -> WARN
      await addExpense(12000, "housing", "2026-07-12"); // over -> OVER
      // transport has no spend -> 0 -> OK

      const res = await listBudgets();
      expect(res.status).toBe(200);

      // listed alphabetically by category
      const byCategory = Object.fromEntries(res.body.map((b) => [b.category, b]));

      expect(byCategory.food).toMatchObject({
        month: "2026-07",
        spentCents: 9000,
        status: "WARN",
      });
      expect(byCategory.housing).toMatchObject({ spentCents: 12000, status: "OVER" });
      expect(byCategory.transport).toMatchObject({ spentCents: 0, status: "OK" });
    });

    test("ignores expenses from other months when summing spend", async () => {
      await setBudget("food", 10000);
      await addExpense(5000, "food", "2026-07-10"); // current month
      await addExpense(9000, "food", "2026-06-10"); // previous month, must not count

      const res = await listBudgets();
      const food = res.body.find((b) => b.category === "food");
      expect(food.spentCents).toBe(5000);
    });
  });
});
