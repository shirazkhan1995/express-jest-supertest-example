const request = require("supertest");
const { createApp } = require("../../src/app");
const { createDb } = require("../../src/db/connection");

const AUTH = "Bearer test-token";

let app;
let db;

// Fresh app + empty in-memory DB before each test, because these tests write
// data. Isolation means no test can see another test's rows (Ground Rule 3).
beforeEach(() => {
  db = createDb(":memory:");
  app = createApp({ db, apiToken: "test-token" });
});

afterEach(() => {
  db.close();
});

// Small helper local to this file — just saves repeating the auth header.
function post(path, body) {
  return request(app).post(path).set("Authorization", AUTH).send(body);
}

describe("Users (component)", () => {
  describe("POST /users", () => {
    test("creates a user and returns 201 with the full shape", async () => {
      const res = await post("/users", { name: "Ada", email: "ada@example.com" });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: expect.any(Number),
        name: "Ada",
        email: "ada@example.com",
        createdAt: expect.any(String),
      });
    });

    test("trims the name and lowercases the email before storing", async () => {
      const res = await post("/users", { name: "  Ada Lovelace  ", email: "ADA@EXAMPLE.COM" });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Ada Lovelace");
      expect(res.body.email).toBe("ada@example.com");
    });

    test("rejects invalid fields with 400 and per-field details", async () => {
      const res = await post("/users", { name: "A", email: "not-an-email" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      // details is an array of { field, message }; both fields are invalid here.
      const fields = res.body.error.details.map((d) => d.field);
      expect(fields).toEqual(expect.arrayContaining(["name", "email"]));
    });

    test("rejects a duplicate email (case-insensitive) with 409", async () => {
      await post("/users", { name: "Ada", email: "ada@example.com" });
      const dup = await post("/users", { name: "Someone Else", email: "ADA@EXAMPLE.COM" });

      expect(dup.status).toBe(409);
      expect(dup.body.error.code).toBe("CONFLICT");
    });
  });

  describe("GET /users/:id", () => {
    test("returns 200 with the user when it exists", async () => {
      const created = await post("/users", { name: "Ada", email: "ada@example.com" });

      const res = await request(app).get(`/users/${created.body.id}`).set("Authorization", AUTH);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(created.body);
    });

    test("returns 404 for an unknown id", async () => {
      const res = await request(app).get("/users/9999").set("Authorization", AUTH);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    test("returns 400 for a non-integer id", async () => {
      const res = await request(app).get("/users/abc").set("Authorization", AUTH);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("GET /users", () => {
    test("lists users in the paginated envelope, ordered by id", async () => {
      await post("/users", { name: "Ada", email: "ada@example.com" });
      await post("/users", { name: "Grace", email: "grace@example.com" });

      const res = await request(app).get("/users").set("Authorization", AUTH);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items.map((u) => u.name)).toEqual(["Ada", "Grace"]);
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(20);
    });
  });

  describe("DELETE /users/:id", () => {
    test("deletes a user (204) so a later fetch returns 404", async () => {
      const created = await post("/users", { name: "Ada", email: "ada@example.com" });
      const id = created.body.id;

      const del = await request(app).delete(`/users/${id}`).set("Authorization", AUTH);
      expect(del.status).toBe(204);
      expect(del.body).toEqual({}); // 204 has no body

      const after = await request(app).get(`/users/${id}`).set("Authorization", AUTH);
      expect(after.status).toBe(404);
    });

    test("returns 404 when deleting an unknown user", async () => {
      const res = await request(app).delete("/users/9999").set("Authorization", AUTH);
      expect(res.status).toBe(404);
    });

    test("cascades: deleting a user removes their expenses", async () => {
      const created = await post("/users", { name: "Ada", email: "ada@example.com" });
      const id = created.body.id;
      await post(`/users/${id}/expenses`, {
        amountCents: 4250,
        category: "food",
        date: "2026-07-10",
      });

      // Sanity: the expense exists in the DB before the delete.
      const before = db.prepare("SELECT COUNT(*) AS n FROM expenses WHERE user_id = ?").get(id);
      expect(before.n).toBe(1);

      await request(app).delete(`/users/${id}`).set("Authorization", AUTH);

      // ON DELETE CASCADE (with foreign_keys = ON) removed the child rows too.
      const after = db.prepare("SELECT COUNT(*) AS n FROM expenses WHERE user_id = ?").get(id);
      expect(after.n).toBe(0);
    });
  });
});
