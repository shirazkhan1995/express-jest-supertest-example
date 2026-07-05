const request = require("supertest");
const { createApp } = require("../../src/app");
const { createDb } = require("../../src/db/connection");

const AUTH = "Bearer test-token";

let app;
let db;
let userId;

// Every expense belongs to a user, so create one fresh user per test and keep
// its id handy. Dates are kept mid-month on purpose so they sit comfortably
// inside any month window.
beforeEach(async () => {
  db = createDb(":memory:");
  app = createApp({ db, apiToken: "test-token" });
  const user = await request(app)
    .post("/users")
    .set("Authorization", AUTH)
    .send({ name: "Ada", email: "ada@example.com" });
  userId = user.body.id;
});

afterEach(() => {
  db.close();
});

function addExpense(body) {
  return request(app).post(`/users/${userId}/expenses`).set("Authorization", AUTH).send(body);
}

function listExpenses(query = "") {
  return request(app).get(`/users/${userId}/expenses${query}`).set("Authorization", AUTH);
}

describe("Expenses (component)", () => {
  describe("POST /users/:id/expenses", () => {
    test("creates an expense and returns 201 with the full shape", async () => {
      const res = await addExpense({
        amountCents: 4250,
        category: "food",
        description: "Groceries",
        date: "2026-07-10",
      });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: expect.any(Number),
        userId,
        amountCents: 4250,
        category: "food",
        description: "Groceries",
        date: "2026-07-10",
        createdAt: expect.any(String),
      });
    });

    test("defaults description to an empty string when omitted", async () => {
      const res = await addExpense({ amountCents: 100, category: "other", date: "2026-07-10" });

      expect(res.status).toBe(201);
      expect(res.body.description).toBe("");
    });

    test("returns 404 when the user does not exist", async () => {
      const res = await request(app)
        .post("/users/9999/expenses")
        .set("Authorization", AUTH)
        .send({ amountCents: 100, category: "food", date: "2026-07-10" });

      expect(res.status).toBe(404);
    });

    test.each([
      ["zero amount", { amountCents: 0, category: "food", date: "2026-07-10" }],
      ["negative amount", { amountCents: -5, category: "food", date: "2026-07-10" }],
      ["non-integer amount", { amountCents: 10.5, category: "food", date: "2026-07-10" }],
      ["amount over the cap", { amountCents: 100000001, category: "food", date: "2026-07-10" }],
      ["invalid category", { amountCents: 100, category: "candy", date: "2026-07-10" }],
      ["impossible date", { amountCents: 100, category: "food", date: "2026-02-30" }],
      ["malformed date", { amountCents: 100, category: "food", date: "07/10/2026" }],
    ])("rejects %s with 400", async (_label, body) => {
      const res = await addExpense(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("GET /users/:id/expenses", () => {
    test("lists a user's expenses newest date first", async () => {
      await addExpense({ amountCents: 100, category: "food", date: "2026-07-01" });
      await addExpense({ amountCents: 200, category: "food", date: "2026-07-20" });

      const res = await listExpenses();

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.items.map((e) => e.date)).toEqual(["2026-07-20", "2026-07-01"]);
    });

    test("filters by category", async () => {
      await addExpense({ amountCents: 100, category: "food", date: "2026-07-10" });
      await addExpense({ amountCents: 200, category: "transport", date: "2026-07-11" });

      const res = await listExpenses("?category=transport");

      expect(res.body.total).toBe(1);
      expect(res.body.items[0].category).toBe("transport");
    });

    test("filters by from/to inclusively on both ends", async () => {
      await addExpense({ amountCents: 1, category: "food", date: "2026-07-01" });
      await addExpense({ amountCents: 2, category: "food", date: "2026-07-15" });
      await addExpense({ amountCents: 3, category: "food", date: "2026-07-31" });

      // Boundaries 07-01 and 07-31 must both be included.
      const res = await listExpenses("?from=2026-07-01&to=2026-07-31");

      expect(res.body.total).toBe(3);
    });

    test("paginates: total counts everything, items is capped by pageSize", async () => {
      for (let day = 1; day <= 3; day++) {
        await addExpense({
          amountCents: day,
          category: "food",
          date: `2026-07-0${day}`,
        });
      }

      const page1 = await listExpenses("?page=1&pageSize=2");
      expect(page1.body.total).toBe(3);
      expect(page1.body.items).toHaveLength(2);

      const page2 = await listExpenses("?page=2&pageSize=2");
      expect(page2.body.total).toBe(3);
      expect(page2.body.items).toHaveLength(1);
    });

    test("rejects a pageSize over the max (100) with 400", async () => {
      const res = await listExpenses("?pageSize=101");
      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /expenses/:id", () => {
    let expenseId;

    beforeEach(async () => {
      const created = await addExpense({
        amountCents: 4250,
        category: "food",
        description: "Groceries",
        date: "2026-07-10",
      });
      expenseId = created.body.id;
    });

    test("updates category and description (200)", async () => {
      const res = await request(app)
        .patch(`/expenses/${expenseId}`)
        .set("Authorization", AUTH)
        .send({ category: "health", description: "Pharmacy" });

      expect(res.status).toBe(200);
      expect(res.body.category).toBe("health");
      expect(res.body.description).toBe("Pharmacy");
    });

    test("rejects updating amountCents with 422 and applies no partial update", async () => {
      const res = await request(app)
        .patch(`/expenses/${expenseId}`)
        .set("Authorization", AUTH)
        .send({ amountCents: 999, description: "should not be applied" });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("IMMUTABLE_FIELD");
      expect(res.body.error.details.fields).toContain("amountCents");

      // Nothing was updated — description is still the original.
      const row = db.prepare("SELECT description, amount_cents FROM expenses WHERE id = ?").get(expenseId);
      expect(row.description).toBe("Groceries");
      expect(row.amount_cents).toBe(4250);
    });

    test("rejects an empty body with 400", async () => {
      const res = await request(app)
        .patch(`/expenses/${expenseId}`)
        .set("Authorization", AUTH)
        .send({});

      expect(res.status).toBe(400);
    });

    test("returns 404 for an unknown expense", async () => {
      const res = await request(app)
        .patch("/expenses/9999")
        .set("Authorization", AUTH)
        .send({ category: "food" });

      expect(res.status).toBe(404);
    });

    test("maps a malformed JSON body to 400", async () => {
      const res = await request(app)
        .patch(`/expenses/${expenseId}`)
        .set("Authorization", AUTH)
        .set("Content-Type", "application/json")
        .send('{"category": '); // deliberately broken JSON

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("DELETE /expenses/:id", () => {
    test("deletes an expense (204)", async () => {
      const created = await addExpense({ amountCents: 100, category: "food", date: "2026-07-10" });

      const del = await request(app).delete(`/expenses/${created.body.id}`).set("Authorization", AUTH);
      expect(del.status).toBe(204);

      const list = await listExpenses();
      expect(list.body.total).toBe(0);
    });

    test("returns 404 for an unknown expense", async () => {
      const res = await request(app).delete("/expenses/9999").set("Authorization", AUTH);
      expect(res.status).toBe(404);
    });
  });
});
