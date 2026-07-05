const request = require("supertest");
const { createApp } = require("../../src/app");
const { createDb } = require("../../src/db/connection");

// Build a fresh app with an empty in-memory database and a known token.
// Everything a component test needs is right here — no separate helper file.
const app = createApp({
  db: createDb(":memory:"),
  apiToken: "test-token",
});

describe("health and auth (component)", () => {
  test("GET /health works without any token", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  test("a protected route returns 401 with no token", async () => {
    const res = await request(app).get("/users");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  test("a protected route returns 401 with the wrong token", async () => {
    const res = await request(app)
      .get("/users")
      .set("Authorization", "Bearer wrong-token");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  test("a protected route works with the correct token", async () => {
    const res = await request(app)
      .get("/users")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  test("an unknown route returns 404", async () => {
    const res = await request(app)
      .get("/nope")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
