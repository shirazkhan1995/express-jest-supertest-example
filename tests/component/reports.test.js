const nock = require("nock");
const request = require("supertest");
const { createApp } = require("../../src/app");
const { createDb } = require("../../src/db/connection");
const { RatesClient } = require("../../src/clients/ratesClient");

const AUTH = "Bearer test-token";

// A fake rates endpoint we fully control with nock. The real service is never called.
const RATES_HOST = "https://rates.test";
const RATES_PATH = "/v6/latest/USD";
const RATES_URL = RATES_HOST + RATES_PATH;

let app;
let db;
let userId;

// Ground Rule 2: no test may touch the real internet. Block everything except
// the local loopback that supertest needs.
beforeAll(() => {
  nock.disableNetConnect();
  nock.enableNetConnect(/127\.0\.0\.1|localhost/);
});

afterAll(() => {
  nock.enableNetConnect();
});

beforeEach(async () => {
  db = createDb(":memory:");
  app = createApp({
    db,
    apiToken: "test-token",
    // Inject a RatesClient pointed at our fake URL so nock can intercept it.
    ratesClient: new RatesClient({ url: RATES_URL, timeoutMs: 1000, cacheTtlMs: 600000 }),
  });

  const user = await request(app)
    .post("/users")
    .set("Authorization", AUTH)
    .send({ name: "Ada", email: "ada@example.com" });
  userId = user.body.id;

  // Two categories of spend, dated mid-month so they fall in July's window.
  for (const [amountCents, category] of [
    [10000, "food"],
    [5000, "transport"],
  ]) {
    await request(app)
      .post(`/users/${userId}/expenses`)
      .set("Authorization", AUTH)
      .send({ amountCents, category, date: "2026-07-10" });
  }
});

afterEach(() => {
  nock.cleanAll();
  db.close();
});

function report(query) {
  return request(app).get(`/users/${userId}/reports/monthly${query}`).set("Authorization", AUTH);
}

describe("Reports (component)", () => {
  test("USD report requires no upstream HTTP call", async () => {
    // Set up an interceptor but expect it NOT to be consumed.
    const scope = nock(RATES_HOST).get(RATES_PATH).reply(200, { rates: { USD: 1, EUR: 0.9 } });

    const res = await report("?month=2026-07");

    expect(res.status).toBe(200);
    expect(res.body.currency).toBe("USD");
    expect(res.body.totalCents).toBe(15000); // 10000 + 5000, unconverted
    expect(scope.isDone()).toBe(false); // upstream was never hit
  });

  test("currency=EUR converts every amount and the total", async () => {
    nock(RATES_HOST).get(RATES_PATH).reply(200, { rates: { USD: 1, EUR: 0.9 } });

    const res = await report("?month=2026-07&currency=EUR");

    expect(res.status).toBe(200);
    expect(res.body.currency).toBe("EUR");
    const byCategory = Object.fromEntries(res.body.categories.map((c) => [c.category, c.totalCents]));
    expect(byCategory.food).toBe(9000); // 10000 * 0.9
    expect(byCategory.transport).toBe(4500); // 5000 * 0.9
    expect(res.body.totalCents).toBe(13500); // sum of the converted totals
  });

  test("caches the rates: two EUR reports, only one upstream hit", async () => {
    // Only ONE interceptor. If the second report tried to fetch again, it would
    // hit disableNetConnect and fail — so a passing second call proves the cache.
    const scope = nock(RATES_HOST).get(RATES_PATH).reply(200, { rates: { USD: 1, EUR: 0.9 } });

    const first = await report("?month=2026-07&currency=EUR");
    const second = await report("?month=2026-07&currency=EUR");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.totalCents).toBe(13500);
    expect(scope.isDone()).toBe(true); // the single interceptor was used once
    expect(nock.pendingMocks()).toHaveLength(0); // nothing left to consume
  });

  test("upstream 500 maps to 502", async () => {
    nock(RATES_HOST).get(RATES_PATH).reply(500, "boom");

    const res = await report("?month=2026-07&currency=EUR");

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("UPSTREAM_ERROR");
  });

  test("upstream network error maps to 502", async () => {
    nock(RATES_HOST).get(RATES_PATH).replyWithError("connection refused");

    const res = await report("?month=2026-07&currency=EUR");

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("UPSTREAM_ERROR");
  });

  test("garbage payload (missing USD:1) maps to 502", async () => {
    nock(RATES_HOST).get(RATES_PATH).reply(200, { rates: { EUR: 0.9 } });

    const res = await report("?month=2026-07&currency=EUR");

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("UPSTREAM_ERROR");
  });

  test("a currency absent from a valid payload maps to 400", async () => {
    // Payload is well-formed (USD:1 present), but GBP isn't in it.
    nock(RATES_HOST).get(RATES_PATH).reply(200, { rates: { USD: 1, EUR: 0.9 } });

    const res = await report("?month=2026-07&currency=GBP");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  describe("request validation (no upstream involved)", () => {
    test("missing month -> 400", async () => {
      const res = await report("");
      expect(res.status).toBe(400);
    });

    test("malformed currency -> 400", async () => {
      const res = await report("?month=2026-07&currency=euro");
      expect(res.status).toBe(400);
    });

    test("unknown user -> 404", async () => {
      const res = await request(app)
        .get("/users/9999/reports/monthly?month=2026-07")
        .set("Authorization", AUTH);
      expect(res.status).toBe(404);
    });
  });
});
